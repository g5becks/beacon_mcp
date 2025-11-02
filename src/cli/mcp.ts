import { buildCommand } from "@stricli/core"
import { startApp } from "../app.js"
import type { CliConfig } from "../types/cli.js"
import { cliLogger } from "./logger.js"

type McpFlags = {
  env?: string
}

const buildCliConfig = (flags: McpFlags): CliConfig => ({
  ...(flags.env ? { envFile: flags.env } : {}),
})

const registerShutdownHandlers = (stop: () => Promise<void>): void => {
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    try {
      cliLogger.info(`Received ${signal}, shutting down MCP server...`)
      await stop()
      cliLogger.info("MCP server stopped successfully")
      process.exit(0)
    } catch (error) {
      cliLogger.error("Error during MCP server shutdown", error)
      process.exit(1)
    }
  }

  process.once("SIGINT", () => {
    shutdown("SIGINT").catch((error) => {
      cliLogger.error("Error during MCP server shutdown", error)
      process.exit(1)
    })
  })

  process.once("SIGTERM", () => {
    shutdown("SIGTERM").catch((error) => {
      cliLogger.error("Error during MCP server shutdown", error)
      process.exit(1)
    })
  })
}

async function mcpCommandImpl(flags: McpFlags): Promise<void> {
  const cliConfig = buildCliConfig(flags)

  try {
    cliLogger.info("Starting Beacon MCP server...")

    const app = await startApp(cliConfig)

    if (!app.server) {
      throw new Error("MCP server not initialized")
    }

    await app.server.start()

    registerShutdownHandlers(async () => {
      await app.server?.stop()
    })

    cliLogger.info("MCP server started successfully")
  } catch (error) {
    cliLogger.error("Failed to start MCP server", error)
    process.exit(1)
  }
}

export const mcpCommand = buildCommand({
  func: mcpCommandImpl,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [],
    },
    flags: {
      env: {
        kind: "parsed",
        parse: (value: string) => value,
        brief: "Path to a dotenv file loaded with highest precedence",
        optional: true,
      },
    },
  },
  docs: {
    brief: "Start the Beacon MCP server",
    fullDescription: `
Start the Beacon MCP server with all services enabled.
The server communicates using stdio following Model Context Protocol conventions.
`,
    customUsage: [
      { input: "mcp", brief: "Start the server with default settings" },
      {
        input: "mcp --env ./local.env",
        brief: "Start the server with an explicit dotenv file",
      },
    ],
  },
})
