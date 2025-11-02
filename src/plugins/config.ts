import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { basename, isAbsolute, join, normalize, resolve } from "node:path"
import { config as dotenvConfig } from "dotenv"
import { expand as dotenvExpand } from "dotenv-expand"
import { ensureDir } from "fs-extra"
import type { ApplicationContext, AppPlugin } from "../types/app-context.js"
import type { CliConfig } from "../types/cli.js"
import type { Environment, ResolvedConfig } from "../types/config.js"
import type { LogLevel } from "../types/constants.js"
import {
  DEFAULT_BASE_DIR_NAME,
  DEFAULT_DB_NAME,
  DEFAULT_LOG_LEVEL,
  DEFAULT_LOGS_DIR_NAME,
  LOG_LEVELS,
  MAX_PROJECT_NAME_LENGTH,
  MAX_RESOLVED_PATH_LENGTH,
  MAX_SANITIZED_PROJECT_NAME_LENGTH,
  PROJECT_NAME_SANITIZE_PREFIX,
} from "../types/constants.js"
import {
  ConfigError,
  PathResolutionError,
  PluginInitError,
} from "../types/errors.js"

export const configPlugin: AppPlugin<CliConfig> = async (
  app: ApplicationContext,
  cliConfig: CliConfig = {}
): Promise<void> => {
  try {
    const resolvedConfig = await loadConfig(cliConfig)
    app.config = resolvedConfig

    process.stderr.write(
      `${JSON.stringify({
        scope: "config",
        event: "loaded",
        project: resolvedConfig.projectName,
        environment: resolvedConfig.environment,
        logLevel: resolvedConfig.logLevel,
      })}\n`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    process.stderr.write(
      `${JSON.stringify({ scope: "config", event: "error", message })}\n`
    )
    if (error instanceof Error && error.stack) {
      process.stderr.write(`${error.stack}\n`)
    }

    throw new PluginInitError("Configuration", message, error)
  }
}

const loadConfig = async (
  cliConfig: CliConfig = {}
): Promise<ResolvedConfig> => {
  const projectRoot = resolve(cliConfig.cwd ?? process.cwd())
  const dotenvFiles: string[] = []

  const loadEnvFile = (
    filePath: string,
    override: boolean,
    required = false
  ) => {
    if (!filePath) {
      return
    }

    if (!existsSync(filePath)) {
      if (required) {
        throw new ConfigError(`Environment file not found: ${filePath}`)
      }
      return
    }

    const result = dotenvConfig({ path: filePath, override })

    if (result.error) {
      throw new ConfigError(`Failed to load environment file: ${filePath}`, {
        file: filePath,
        cause: result.error.message,
      })
    }

    dotenvExpand(result)
    dotenvFiles.push(filePath)
  }

  const resolveCliPath = (input: string): string => {
    const normalized = normalize(input)
    if (normalized.length === 0) {
      throw new ConfigError("CLI path cannot be empty")
    }
    return isAbsolute(normalized)
      ? normalized
      : normalize(resolve(projectRoot, normalized))
  }

  const globalEnvPath = join(homedir(), DEFAULT_BASE_DIR_NAME, ".env")
  loadEnvFile(globalEnvPath, false)

  const projectEnvPath = join(projectRoot, ".env")
  loadEnvFile(projectEnvPath, true)

  const cliEnvPath = cliConfig.envFile
    ? resolveCliPath(cliConfig.envFile)
    : undefined
  if (cliEnvPath) {
    loadEnvFile(cliEnvPath, true, true)
  }

  const projectName = sanitizeProjectName(
    cliConfig.project ?? process.env.BEACON_PROJECT ?? basename(projectRoot)
  )

  const baseDir = resolveDirectory(
    process.env.BEACON_HOME ?? join(homedir(), DEFAULT_BASE_DIR_NAME),
    projectRoot,
    "base directory"
  )

  const projectDir = resolveDirectory(
    join(baseDir, projectName),
    projectRoot,
    "project directory"
  )
  const logsDir = resolveDirectory(
    join(projectDir, DEFAULT_LOGS_DIR_NAME),
    projectRoot,
    "logs directory"
  )
  const databasePath = join(projectDir, DEFAULT_DB_NAME)

  await ensureDirectory(baseDir, "base directory")
  await ensureDirectory(projectDir, "project directory")
  await ensureDirectory(logsDir, "logs directory")

  const logLevel = normalizeLogLevel(
    cliConfig.logLevel ?? process.env.BEACON_LOG_LEVEL ?? DEFAULT_LOG_LEVEL
  )
  const environment = normalizeEnvironment(
    process.env.BEACON_ENV ?? process.env.NODE_ENV ?? "development"
  )

  return {
    projectName,
    projectRoot,
    baseDir,
    projectDir,
    databasePath,
    logsDir,
    environment,
    logLevel,
    dotenvFiles,
  }
}

const sanitizeProjectName = (input: string): string => {
  if (!input || typeof input !== "string") {
    throw new ConfigError("Project name must be a non-empty string")
  }

  const trimmed = input.trim()
  if (!trimmed) {
    throw new ConfigError("Project name cannot be only whitespace")
  }

  if (trimmed.length > MAX_PROJECT_NAME_LENGTH) {
    throw new ConfigError(
      `Project name cannot exceed ${MAX_PROJECT_NAME_LENGTH} characters`
    )
  }

  const sanitized = trimmed
    .replace(/[\\/]/g, "_")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .replace(PROJECT_NAME_SANITIZE_PREFIX, "")
    .slice(0, MAX_SANITIZED_PROJECT_NAME_LENGTH)

  if (!sanitized) {
    throw new ConfigError(
      "Project name must contain at least one valid character (a-z, A-Z, 0-9, underscore, hyphen, or dot)"
    )
  }

  return sanitized
}

type DirectoryLabel = "base directory" | "project directory" | "logs directory"

const resolveDirectory = (
  pathInput: string,
  projectRoot: string,
  label: DirectoryLabel
): string => {
  if (!pathInput || typeof pathInput !== "string") {
    throw new PathResolutionError(
      String(pathInput),
      `${label} must be a non-empty string`
    )
  }

  if (pathInput.length > MAX_RESOLVED_PATH_LENGTH) {
    throw new PathResolutionError(
      pathInput,
      `${label} is too long (maximum ${MAX_RESOLVED_PATH_LENGTH} characters)`
    )
  }

  if (pathInput.includes("..")) {
    throw new PathResolutionError(
      pathInput,
      `${label} cannot contain parent directory references`
    )
  }

  const resolvedPath = isAbsolute(pathInput)
    ? normalize(pathInput)
    : normalize(resolve(projectRoot, pathInput))

  if (resolvedPath.length > MAX_RESOLVED_PATH_LENGTH) {
    throw new PathResolutionError(
      resolvedPath,
      `${label} is too long (maximum ${MAX_RESOLVED_PATH_LENGTH} characters)`
    )
  }

  return resolvedPath
}

const ensureDirectory = async (
  dirPath: string,
  label: DirectoryLabel
): Promise<void> => {
  try {
    await ensureDir(dirPath)
  } catch (error) {
    throw new PathResolutionError(dirPath, describeFsError(label, error), error)
  }
}

const describeFsError = (label: DirectoryLabel, error: unknown): string => {
  if (!(error instanceof Error)) {
    return `failed to create ${label}`
  }

  const message = error.message.toLowerCase()

  if (message.includes("eacces") || message.includes("permission")) {
    return `permission denied while creating ${label}`
  }

  if (message.includes("enospc") || message.includes("no space")) {
    return `no space left on device while creating ${label}`
  }

  if (message.includes("erofs") || message.includes("read-only")) {
    return `read-only file system while creating ${label}`
  }

  if (message.includes("emfile") || message.includes("enfile")) {
    return `too many open files while creating ${label}`
  }

  return `failed to create ${label}`
}

const LOG_LEVEL_SET = new Set<LogLevel>(LOG_LEVELS)

const normalizeLogLevel = (value: string): LogLevel => {
  const normalized = value.trim().toLowerCase() as LogLevel

  if (!LOG_LEVEL_SET.has(normalized)) {
    throw new ConfigError(`Invalid log level: ${value}`, {
      allowed: LOG_LEVELS,
    })
  }

  return normalized
}

const normalizeEnvironment = (value: string): Environment => {
  const normalized = value.trim().toLowerCase()

  if (normalized === "development" || normalized === "dev") {
    return "development"
  }

  if (normalized === "production" || normalized === "prod") {
    return "production"
  }

  if (normalized === "testing" || normalized === "test") {
    return "testing"
  }

  throw new ConfigError(`Invalid environment: ${value}`, {
    allowed: ["development", "testing", "production"],
  })
}
