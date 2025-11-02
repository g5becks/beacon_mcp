import avvio from "avvio"
import { configPlugin } from "./plugins/config.js"
import { databasePlugin } from "./plugins/database.js"
import { loggerPlugin } from "./plugins/logger.js"
import { queryEnginePlugin } from "./plugins/query-engine.js"
import { serverPlugin } from "./plugins/server.js"
import type { ApplicationContext } from "./types/app-context.js"
import type { CliConfig } from "./types/cli.js"

const APP_NAME = "beacon-mcp"
const APP_VERSION = "1.0.0"
const DEFAULT_TIMEOUT_MS = 30_000

const logInfo = (context: ApplicationContext, message: string): void => {
  if (context.logger) {
    context.logger.info({ scope: "app" }, message)
    return
  }
  process.stderr.write(`${message}\n`)
}

const logError = (
  context: ApplicationContext,
  message: string,
  error?: unknown
): void => {
  if (context.logger) {
    context.logger.error({ scope: "app", err: error }, message)
    return
  }
  process.stderr.write(`${message}\n`)
  if (error instanceof Error && error.stack) {
    process.stderr.write(`${error.stack}\n`)
  }
}

const registerLifecycleHooks = (app: avvio.Avvio<ApplicationContext>): void => {
  app.on("start", () => {
    const context = app as unknown as ApplicationContext
    logInfo(context, "Application starting...")
  })

  app.on("preReady", () => {
    const context = app as unknown as ApplicationContext
    logInfo(context, "Application pre-ready phase")
  })

  app.ready((error: Error | undefined) => {
    if (error) {
      const context = app as unknown as ApplicationContext
      logError(context, "Failed to start application", error)
      return
    }

    const context = app as unknown as ApplicationContext
    context.isReady = true
    logInfo(context, "Application ready")
  })
}

export const createApp = (
  options: { timeout?: number } = {}
): avvio.Avvio<ApplicationContext> => {
  const { timeout = DEFAULT_TIMEOUT_MS } = options

  const baseContext: ApplicationContext = {
    name: APP_NAME,
    version: APP_VERSION,
    isReady: false,
  }

  const app = avvio(baseContext, {
    autostart: false,
    timeout,
    expose: {
      use: "use",
    },
  })

  registerLifecycleHooks(app)

  return app
}

export const startApp = async (
  cliConfig: CliConfig = {},
  options: { timeout?: number } = {}
): Promise<ApplicationContext> => {
  const app = createApp(options)

  try {
    app.use(configPlugin, cliConfig)
    app.use(loggerPlugin)
    app.use(databasePlugin)
    app.use(queryEnginePlugin)
    app.use(serverPlugin)
    await app.ready()
    return app as unknown as ApplicationContext
  } catch (error) {
    const context = app as unknown as ApplicationContext
    logError(context, "Failed to start application", error)
    throw error
  }
}
