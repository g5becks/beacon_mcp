import { join } from "node:path"
import FileStreamRotator from "file-stream-rotator"
import type { Level, StreamEntry } from "pino"
import pino, { multistream, stdTimeFunctions } from "pino"
import type { ApplicationContext, AppPlugin } from "../types/app-context.js"
import type { ResolvedConfig } from "../types/config.js"
import {
  LOG_ROTATION_AUDIT_FILE,
  LOG_ROTATION_FILE_EXTENSION,
  LOG_ROTATION_FILE_PATTERN,
  LOG_ROTATION_FREQUENCY,
  LOG_ROTATION_MAX_HISTORY,
  LOG_ROTATION_MAX_SIZE,
  LOG_ROTATION_SYMLINK_NAME,
  LOG_TO_CONSOLE_ENV,
} from "../types/constants.js"
import { PluginDependencyError, PluginInitError } from "../types/errors.js"

const resolveLogLevel = (config: ResolvedConfig): Level => {
  const debugEnv = process.env.DEBUG
  if (typeof debugEnv === "string" && debugEnv.trim().length > 0) {
    return "debug"
  }
  return config.logLevel as Level
}

const shouldLogToConsole = (): boolean => {
  const flag = process.env[LOG_TO_CONSOLE_ENV]
  if (flag === undefined) {
    return true
  }

  const normalized = flag.trim().toLowerCase()
  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no" ||
    normalized === "off"
  ) {
    return false
  }

  if (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  ) {
    return true
  }

  return true
}

const createRotatingStream = (config: ResolvedConfig) =>
  FileStreamRotator.getStream({
    filename: join(config.logsDir, LOG_ROTATION_FILE_PATTERN),
    extension: LOG_ROTATION_FILE_EXTENSION,
    frequency: LOG_ROTATION_FREQUENCY,
    size: LOG_ROTATION_MAX_SIZE,
    max_logs: LOG_ROTATION_MAX_HISTORY,
    audit_file: join(config.logsDir, LOG_ROTATION_AUDIT_FILE),
    create_symlink: true,
    symlink_name: LOG_ROTATION_SYMLINK_NAME,
  })

const createPinoLogger = (config: ResolvedConfig) => {
  const level = resolveLogLevel(config)
  const fileStream = createRotatingStream(config)
  const streamsConfig: StreamEntry[] = [{ level, stream: fileStream }]

  if (shouldLogToConsole()) {
    const stderrStream = pino.destination({ dest: 2, sync: false })
    streamsConfig.push({ level, stream: stderrStream })
  }

  const streams = multistream(streamsConfig)

  return pino(
    {
      level,
      base: undefined,
      timestamp: stdTimeFunctions.isoTime,
      messageKey: "msg",
      formatters: {
        level(label) {
          return { level: label }
        },
      },
      mixin() {
        return { project: config.projectName }
      },
    },
    streams
  )
}

export const loggerPlugin: AppPlugin = (app: ApplicationContext): void => {
  try {
    if (!app.config) {
      throw new PluginDependencyError("Logger", "Configuration")
    }

    const config = app.config
    if (!config.logsDir) {
      throw new PluginInitError(
        "Logger",
        "logsDir was not provided in configuration"
      )
    }

    const logger = createPinoLogger(config)
    app.logger = logger

    logger.info(
      {
        logsDir: config.logsDir,
        environment: config.environment,
      },
      "Logger initialized"
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    process.stderr.write(
      `${JSON.stringify({ scope: "logger", event: "error", message })}\n`
    )
    if (error instanceof Error && error.stack) {
      process.stderr.write(`${error.stack}\n`)
    }

    throw new PluginInitError("Logger", message, error)
  }
}
