/**
 * Custom Error Classes for Beacon MCP
 *
 * Provides structured, type-safe error handling with error codes for
 * the Path-based Knowledge Management Server.
 */

import type { Logger } from "./logger.js"

const CONNECTION_ERROR_PATTERNS = ["connection", "unable to open"] as const
const CONCURRENCY_ERROR_PATTERNS = [
  "lock",
  "concurrent",
  "busy",
  "locked",
] as const
const CONSTRAINT_ERROR_PATTERNS = ["constraint", "duplicate", "unique"] as const
const SCHEMA_ERROR_PATTERNS = ["schema", "column", "table", "no such"] as const
const SYNTAX_ERROR_PATTERNS = ["syntax", "parse"] as const

/**
 * Standardized error codes for Beacon MCP operations
 *
 * Error codes follow HTTP status conventions:
 * - 4xx equivalent: Client/validation errors
 * - 5xx equivalent: Server/internal errors
 */
export type ErrorCode =
  // Validation errors (4xx equivalent)
  | "INVALID_INPUT"
  | "INVALID_PATH"
  | "INVALID_KNOWLEDGE_TYPE"
  | "INVALID_TITLE"
  | "INVALID_CONTENT"
  | "INVALID_METADATA"
  | "INVALID_SEARCH_QUERY"
  | "INVALID_GLOB_PATTERN"
  | "PATH_TOO_LONG"
  | "CONTENT_TOO_LONG"
  // Configuration errors
  | "INVALID_CONFIG"
  | "PATH_RESOLUTION_ERROR"
  | "PLUGIN_INIT_ERROR"
  | "PLUGIN_DEPENDENCY_ERROR"
  | "DATABASE_CONFIG_ERROR"
  | "LOGGER_CONFIG_ERROR"
  | "MCP_CONFIG_ERROR"
  // Not found errors (404 equivalent)
  | "KNOWLEDGE_NOT_FOUND"
  | "PATH_NOT_FOUND"
  | "DATABASE_NOT_FOUND"
  // Conflict errors (409 equivalent)
  | "KNOWLEDGE_ALREADY_EXISTS"
  | "PATH_ALREADY_EXISTS"
  | "DATABASE_LOCKED"
  | "CONCURRENCY_ERROR"
  // Internal errors (5xx equivalent)
  | "DATABASE_ERROR"
  | "QUERY_ERROR"
  | "MIGRATION_ERROR"
  | "LOCK_ACQUISITION_ERROR"
  | "INTERNAL_ERROR"

/**
 * Base error class for all Beacon MCP errors
 *
 * All custom errors inherit from this class to provide
 * consistent error structure and behavior.
 */
export class BeaconError extends Error {
  readonly code: ErrorCode
  readonly details?: Record<string, unknown>

  /**
   * Creates a new BeaconError
   *
   * @param code - Standardized error code
   * @param message - Human-readable error message
   * @param details - Optional additional error details
   */
  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = "BeaconError"
    this.code = code
    this.details = details
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * Convert to MCP error message format
   * Format: "ERROR_CODE: message (details)"
   *
   * @returns Formatted error message for MCP responses
   */
  toMCPMessage(): string {
    const detailsStr = this.details ? ` (${JSON.stringify(this.details)})` : ""
    return `${this.code}: ${this.message}${detailsStr}`
  }
}

/**
 * Validation error
 *
 * Thrown when input validation fails for user-provided data.
 *
 * @example
 * ```typescript
 * throw new ValidationError("Invalid knowledge path", {
 *   path: "invalid path with spaces",
 *   reason: "Path contains invalid characters"
 * })
 * ```
 */
export class ValidationError extends BeaconError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("INVALID_INPUT", message, details)
    this.name = "ValidationError"
  }
}

/**
 * Invalid path error
 *
 * Thrown when a knowledge path fails validation or doesn't conform to
 * the required format.
 *
 * @example
 * ```typescript
 * throw new InvalidPathError("path with spaces", "Path contains invalid characters")
 * ```
 */
export class InvalidPathError extends BeaconError {
  constructor(path: string, reason: string) {
    super("INVALID_PATH", `Invalid knowledge path: ${path}. ${reason}`, {
      path,
      reason,
    })
    this.name = "InvalidPathError"
  }
}

/**
 * Knowledge not found error
 *
 * Thrown when a knowledge entry doesn't exist at the specified path or ID.
 *
 * @example
 * ```typescript
 * throw new KnowledgeNotFoundError("decision/api/design")
 * ```
 */
export class KnowledgeNotFoundError extends BeaconError {
  constructor(identifier: string, type: "path" | "id" = "path") {
    const message =
      type === "id"
        ? `Knowledge entry not found with ID: ${identifier}`
        : `Knowledge entry not found at path: ${identifier}`

    super("KNOWLEDGE_NOT_FOUND", message, { identifier, type })
    this.name = "KnowledgeNotFoundError"
  }
}

/**
 * Path not found error
 *
 * Thrown when attempting to resolve a path that doesn't exist in the knowledge base.
 *
 * @example
 * ```typescript
 * throw new PathNotFoundError("/nonexistent/path")
 * ```
 */
export class PathNotFoundError extends BeaconError {
  constructor(path: string) {
    super("PATH_NOT_FOUND", `Path not found: ${path}`, { path })
    this.name = "PathNotFoundError"
  }
}

/**
 * Knowledge already exists error
 *
 * Thrown when attempting to create a knowledge entry that already exists.
 *
 * @example
 * ```typescript
 * throw new KnowledgeAlreadyExistsError("decision/api/design")
 * ```
 */
export class KnowledgeAlreadyExistsError extends BeaconError {
  constructor(path: string) {
    super(
      "KNOWLEDGE_ALREADY_EXISTS",
      `Knowledge already exists at path: ${path}`,
      {
        path,
      }
    )
    this.name = "KnowledgeAlreadyExistsError"
  }
}

/**
 * Database error
 *
 * Thrown when database operations fail due to connection issues, query errors,
 * or other database-related problems.
 *
 * @example
 * ```typescript
 * try {
 *   await db.query("SELECT * FROM knowledge")
 * } catch (err) {
 *   throw new DatabaseError("Failed to query knowledge", err)
 * }
 * ```
 */
export class DatabaseError extends BeaconError {
  constructor(message: string, cause?: Error) {
    super("DATABASE_ERROR", message, { cause: cause?.message })
    this.name = "DatabaseError"
  }
}

/**
 * Query error
 *
 * Thrown when SQL query execution fails due to syntax errors, constraint violations,
 * or other query-specific issues.
 *
 * @example
 * ```typescript
 * throw new QueryError("Invalid SQL syntax", { query: "SELECT * FROM", line: 1 })
 * ```
 */
export class QueryError extends BeaconError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("QUERY_ERROR", message, details)
    this.name = "QueryError"
  }
}

/**
 * Migration error
 *
 * Thrown when database schema migrations fail.
 *
 * @example
 * ```typescript
 * throw new MigrationError("Failed to apply migration 001", {
 *   migration: "001_initial_schema.sql",
 *   cause: "Table already exists"
 * })
 * ```
 */
export class MigrationError extends BeaconError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("MIGRATION_ERROR", message, details)
    this.name = "MigrationError"
  }
}

/**
 * Concurrency error
 *
 * Thrown when concurrent access conflicts occur, such as failing to acquire
 * a file lock or encountering transaction conflicts.
 *
 * @example
 * ```typescript
 * throw new ConcurrencyError("Failed to acquire database lock", {
 *   lockPath: "/path/to/beacon.duckdb.lock",
 *   retries: 3,
 *   waitTime: 300
 * })
 * ```
 */
export class ConcurrencyError extends BeaconError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CONCURRENCY_ERROR", message, details)
    this.name = "ConcurrencyError"
  }
}

/**
 * Lock acquisition error
 *
 * Thrown when unable to acquire a file lock for database access.
 *
 * @example
 * ```typescript
 * throw new LockAcquisitionError("Database locked by another process", {
 *   lockFile: "beacon.duckdb.lock",
 *   staleTimeout: 10000
 * })
 * ```
 */
export class LockAcquisitionError extends BeaconError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("LOCK_ACQUISITION_ERROR", message, details)
    this.name = "LockAcquisitionError"
  }
}

/**
 * Configuration error
 *
 * Thrown when configuration loading, parsing, or validation fails.
 *
 * @example
 * ```typescript
 * throw new ConfigError("Invalid database configuration", {
 *   configPath: "./beacon.config.json",
 *   issue: "Missing required field: database.location"
 * })
 * ```
 */
export class ConfigError extends BeaconError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("INVALID_CONFIG", message, details)
    this.name = "ConfigError"
  }
}

/**
 * Path resolution error
 */
export class PathResolutionError extends BeaconError {
  constructor(path: string, reason: string, cause?: unknown) {
    super(
      "PATH_RESOLUTION_ERROR",
      `Failed to resolve path: ${path}. ${reason}`,
      {
        path,
        reason,
        cause: cause instanceof Error ? cause.message : cause,
      }
    )
    this.name = "PathResolutionError"
  }
}

/**
 * Plugin initialization error
 */
export class PluginInitError extends BeaconError {
  constructor(pluginName: string, message: string, cause?: unknown) {
    super(
      "PLUGIN_INIT_ERROR",
      `Failed to initialize ${pluginName} plugin: ${message}`,
      {
        plugin: pluginName,
        cause: cause instanceof Error ? cause.message : cause,
      }
    )
    this.name = "PluginInitError"
  }
}

/**
 * Plugin dependency error
 */
export class PluginDependencyError extends BeaconError {
  constructor(pluginName: string, dependencyName: string) {
    super(
      "PLUGIN_DEPENDENCY_ERROR",
      `${pluginName} plugin requires ${dependencyName}`,
      {
        plugin: pluginName,
        dependency: dependencyName,
      }
    )
    this.name = "PluginDependencyError"
  }
}

const includesAny = (value: string, patterns: readonly string[]): boolean =>
  patterns.some((pattern) => value.includes(pattern))

/**
 * Handles DuckDB errors with better error messages and structured error types.
 *
 * @param error - The error to handle
 * @param logger - Optional logger to log detailed error information
 * @returns A BeaconError (usually a DatabaseError) with a user-friendly message
 */
export function handleDuckDBError(error: unknown, logger?: Logger): Error {
  // Log the original error for debugging
  logger?.error(
    {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    "DuckDB error occurred"
  )

  // Handle specific DuckDB error patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (includesAny(message, CONNECTION_ERROR_PATTERNS)) {
      return new DatabaseError("Failed to connect to database", error)
    }

    if (includesAny(message, CONCURRENCY_ERROR_PATTERNS)) {
      return new ConcurrencyError(
        "Database access conflict - please try again",
        {
          cause: error.message,
        }
      )
    }

    if (includesAny(message, CONSTRAINT_ERROR_PATTERNS)) {
      return new BeaconError(
        "KNOWLEDGE_ALREADY_EXISTS",
        "Knowledge entry already exists",
        { cause: error.message }
      )
    }

    if (includesAny(message, SCHEMA_ERROR_PATTERNS)) {
      return new QueryError("Database schema error", { cause: error.message })
    }

    if (includesAny(message, SYNTAX_ERROR_PATTERNS)) {
      return new QueryError("SQL syntax error", { cause: error.message })
    }

    // Generic database error
    return new DatabaseError(
      `Database operation failed: ${error.message}`,
      error
    )
  }

  // Unknown error type
  return new BeaconError(
    "INTERNAL_ERROR",
    `An unknown error occurred: ${String(error)}`
  )
}
