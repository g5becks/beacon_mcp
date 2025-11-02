import { createDatabase } from "../storage/database.js"
import type { ApplicationContext, AppPlugin } from "../types/app-context.js"
import type { DatabaseConfig } from "../types/database.js"
import { PluginDependencyError, PluginInitError } from "../types/errors.js"

export const databasePlugin: AppPlugin = async (
  app: ApplicationContext
): Promise<void> => {
  if (!app.config) {
    throw new PluginDependencyError("Database", "Configuration")
  }

  if (!app.logger) {
    throw new PluginDependencyError("Database", "Logger")
  }

  if (!app.config.databasePath) {
    throw new PluginInitError(
      "Database",
      "databasePath was not provided in configuration"
    )
  }

  const config: DatabaseConfig = {
    location: app.config.databasePath,
    logger: app.logger,
    environment: app.config.environment,
  }

  try {
    const database = await createDatabase(config)
    app.database = database

    app.logger.info(
      { location: config.location, environment: config.environment },
      "Database initialized"
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    app.logger.error(
      { err: error, location: config.location },
      "Database initialization failed"
    )

    throw new PluginInitError("Database", message, error)
  }
}
