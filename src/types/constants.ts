/**
 * Application Constants
 *
 * Centralized constants for Beacon MCP - Path-based Knowledge Management Server
 */

import { join } from "node:path"

// ============================================================================
// Validation Constants (for Zod schemas)
// ============================================================================

/**
 * Minimum length for non-empty strings
 */
export const MIN_STRING_LENGTH = 1

/**
 * Maximum path length for knowledge entries
 */
export const MAX_PATH_LENGTH = 500

/**
 * Maximum title length for knowledge entries
 */
export const MAX_TITLE_LENGTH = 200

/**
 * Maximum length for project names supplied via CLI or environment
 */
export const MAX_PROJECT_NAME_LENGTH = 200

/**
 * Maximum length for sanitized project names used for filesystem paths
 */
export const MAX_SANITIZED_PROJECT_NAME_LENGTH = 50

/**
 * Maximum content length for knowledge entries (1MB characters)
 */
export const MAX_CONTENT_LENGTH = 1_048_576

/**
 * Maximum metadata key length
 */
export const MAX_METADATA_KEY_LENGTH = 100

/**
 * Maximum metadata value length (JSON string)
 */
export const MAX_METADATA_VALUE_LENGTH = 10_000

/**
 * Maximum number of metadata entries
 */
export const MAX_METADATA_ENTRIES = 100

// ============================================================================
// Knowledge Management Constants
// ============================================================================

/**
 * Supported knowledge entry types
 */
export const KNOWLEDGE_TYPES = ["rule", "decision", "details"] as const

/**
 * Default limit for search results
 */
export const DEFAULT_SEARCH_LIMIT = 20

/**
 * Maximum search results limit
 */
export const MAX_SEARCH_LIMIT = 100

/**
 * Default offset for search results
 */
export const DEFAULT_SEARCH_OFFSET = 0

/**
 * Maximum ancestors depth for path resolution
 */
export const MAX_ANCESTORS_DEPTH = 50

/**
 * Maximum allowable length for resolved filesystem paths
 */
export const MAX_RESOLVED_PATH_LENGTH = 4096

// ============================================================================
// Database Constants
// ============================================================================

/**
 * Default name for the application base directory inside the user's home folder
 */
export const DEFAULT_BASE_DIR_NAME = ".beacon"

/**
 * Default directory name for project logs
 */
export const DEFAULT_LOGS_DIR_NAME = "logs"

/**
 * Default database file name
 */
export const DEFAULT_DB_NAME = "beacon.duckdb"

/**
 * Default database path relative to project root
 */
export const DEFAULT_DB_PATH = join(DEFAULT_DB_NAME)

/**
 * Database connection timeout in milliseconds
 */
export const DB_CONNECTION_TIMEOUT = 10_000

/**
 * Maximum database connection retries
 */
export const MAX_DB_RETRIES = 3

/**
 * Delay between database connection retries in milliseconds
 */
export const DB_RETRY_DELAY = 1000

// ============================================================================
// File Locking Constants
// ============================================================================

/**
 * Lock file stale timeout in milliseconds (10 seconds)
 */
export const LOCK_STALE_TIMEOUT = 10_000

/**
 * Maximum lock acquisition retries
 */
export const MAX_LOCK_RETRIES = 3

/**
 * Initial lock retry delay in milliseconds
 */
export const LOCK_RETRY_DELAY = 100

/**
 * Lock file extension
 */
export const LOCK_FILE_EXTENSION = ".lock"

// ============================================================================
// MCP Server Constants
// ============================================================================

/**
 * MCP server name
 */
export const MCP_SERVER_NAME = "beacon-mcp"

/**
 * MCP server version
 */
export const MCP_SERVER_VERSION = "1.0.0"

/**
 * Default MCP server port
 */
export const DEFAULT_MCP_PORT = 3000

/**
 * Default MCP server host
 */
export const DEFAULT_MCP_HOST = "localhost"

// ============================================================================
// Logging Constants
// ============================================================================

/**
 * Supported log levels
 */
export const LOG_LEVELS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

/**
 * Default log level
 */
export const DEFAULT_LOG_LEVEL = "info"

/**
 * Maximum log file size before rotation (default: 10MB)
 */
export const DEFAULT_MAX_LOG_SIZE = "10MB"

/**
 * Maximum number of log files to retain
 */
export const DEFAULT_MAX_LOG_FILES = 5

/**
 * Environment variable controlling whether logs also stream to stderr
 */
export const LOG_TO_CONSOLE_ENV = "LOG_TO_CONSOLE"

/**
 * Default log rotation file pattern without extension
 */
export const LOG_ROTATION_FILE_PATTERN = "beacon-%DATE%"

/**
 * Default log rotation file extension
 */
export const LOG_ROTATION_FILE_EXTENSION = ".log"

/**
 * Log rotation symlink name pointing to current log file
 */
export const LOG_ROTATION_SYMLINK_NAME = "current.log"

/**
 * Log rotation frequency (daily)
 */
export const LOG_ROTATION_FREQUENCY = "daily"

/**
 * Maximum log retention duration for rotated files
 */
export const LOG_ROTATION_MAX_HISTORY = "14d"

/**
 * Maximum log file size before rotation
 */
export const LOG_ROTATION_MAX_SIZE = "20m"

/**
 * Audit file used by file-stream-rotator to track rotations
 */
export const LOG_ROTATION_AUDIT_FILE = ".logs-audit.json"

// ============================================================================
// Path Resolution Constants
// ============================================================================

/**
 * Path separator for hierarchical knowledge organization
 *
 * Note: We use forward slash (/) consistently for knowledge paths regardless of platform.
 * Knowledge paths are logical identifiers, not filesystem paths. This ensures:
 * - Consistent path behavior across Windows, macOS, and Linux
 * - Predictable path matching and glob pattern handling
 * - Easy migration between platforms
 */
export const PATH_SEPARATOR = "/"

/**
 * Root path identifier
 *
 * The root of the knowledge hierarchy. All knowledge paths start with this.
 */
export const ROOT_PATH = "/"

/**
 * Pattern for validating path segments
 *
 * Allows alphanumeric characters, hyphens, and underscores.
 * Ensures paths are URL-safe and filesystem-compatible across platforms.
 */
export const PATH_SEGMENT_PATTERN = /^[a-zA-Z0-9_-]+$/

/**
 * Maximum path segment length
 *
 * Each segment between path separators has this length limit.
 */
export const MAX_PATH_SEGMENT_LENGTH = 50

/**
 * Regex used to strip unsupported leading characters from sanitized project names
 */
export const PROJECT_NAME_SANITIZE_PREFIX = /^[._-]+/

// ============================================================================
// Glob Pattern Constants
// ============================================================================

/**
 * Glob pattern wildcard character
 *
 * Matches any sequence of characters within a single path segment.
 */
export const GLOB_WILDCARD = "*"

/**
 * Glob pattern recursive wildcard
 *
 * Matches any sequence of characters across multiple path segments.
 */
export const GLOB_RECURSIVE = "**"

/**
 * Glob pattern character ranges delimiter
 *
 * Used for character class patterns like [a-z] or [0-9].
 */
export const GLOB_RANGE_DELIMITER = "[]"

/**
 * Minimum snippet length returned in search results
 */
export const MIN_SNIPPET_LENGTH = 50

/**
 * Maximum snippet length returned in search results
 */
export const MAX_SNIPPET_LENGTH = 500

/**
 * Default snippet length returned in search results
 */
export const DEFAULT_SNIPPET_LENGTH = 200

/**
 * Default query timeout for query builders in milliseconds
 */
export const DEFAULT_QUERY_TIMEOUT_MS = 30_000

/**
 * Directory traversal sequence used to detect parent directory references
 */
export const DIRECTORY_TRAVERSAL_SEQUENCE = ".."

// ============================================================================
// Timestamp Constants
// ============================================================================

/**
 * Milliseconds per second
 */
export const MILLISECONDS_PER_SECOND = 1000

/**
 * Seconds per minute
 */
export const SECONDS_PER_MINUTE = 60

/**
 * Minutes per hour
 */
export const MINUTES_PER_HOUR = 60

/**
 * Hours per day
 */
export const HOURS_PER_DAY = 24

/**
 * Milliseconds per minute
 */
export const MILLISECONDS_PER_MINUTE =
  SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND

/**
 * Milliseconds per hour
 */
export const MILLISECONDS_PER_HOUR = MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE

/**
 * Milliseconds per day
 */
export const MILLISECONDS_PER_DAY = HOURS_PER_DAY * MILLISECONDS_PER_HOUR
