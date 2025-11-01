/**
 * Resolved configuration values available after plugin initialization.
 */

export type Environment = "development" | "production" | "testing";

export type ResolvedConfig = {
  projectName: string;
  projectRoot: string;
  baseDir: string;
  projectDir: string;
  databasePath: string;
  logsDir: string;
  environment: Environment;
  logLevel: string;
  dotenvFiles: string[];
};
