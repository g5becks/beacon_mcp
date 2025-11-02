import { createMcpServer } from "../mcp/server.js"
import type { ApplicationContext, AppPlugin } from "../types/app-context.js"
import { PluginDependencyError, PluginInitError } from "../types/errors.js"

const PLUGIN_NAME = "Server"

export const serverPlugin: AppPlugin = (app: ApplicationContext): void => {
  if (!app.logger) {
    throw new PluginDependencyError(PLUGIN_NAME, "Logger")
  }

  if (!app.database) {
    throw new PluginDependencyError(PLUGIN_NAME, "Database")
  }

  if (!app.queryEngine) {
    throw new PluginDependencyError(PLUGIN_NAME, "QueryEngine")
  }

  const logger = app.logger

  if (app.server) {
    logger.warn({ scope: "mcp-server" }, "MCP server already initialized")
    return
  }

  try {
    const server = createMcpServer({
      logger,
      database: app.database,
      queryEngine: app.queryEngine,
    })

    app.server = server

    logger.info({ scope: "mcp-server" }, "MCP server initialized")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    logger.error(
      { err: error, scope: "mcp-server" },
      "Failed to initialize MCP server"
    )

    throw new PluginInitError(PLUGIN_NAME, message, error)
  }
}
