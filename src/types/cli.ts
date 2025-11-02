/**
 * CLI configuration parameters available during startup.
 */

export type CliConfig = {
  /** Optional project identifier used for scoping resolved paths */
  project?: string
  /** Optional explicit working directory */
  cwd?: string
  /** Optional dotenv file path loaded with highest precedence */
  envFile?: string
  /** Override for log level */
  logLevel?: string
}
