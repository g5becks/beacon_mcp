#!/usr/bin/env node
import { createRequire } from "node:module"
import { buildApplication, buildRouteMap, run } from "@stricli/core"
import type { PackageJson } from "type-fest"
import { listCommand } from "./commands/list.js"
import { mcpCommand } from "./commands/mcp.js"
import { searchCommand } from "./commands/search.js"
import { storeCommand } from "./commands/store.js"
import { cliLogger } from "./logger.js"

const COMMAND_ROUTES = buildRouteMap({
  routes: {
    mcp: mcpCommand,
    list: listCommand,
    search: searchCommand,
    store: storeCommand,
  },
  docs: {
    brief: "Beacon MCP CLI",
    fullDescription:
      "Command line interface for the Beacon MCP path-based knowledge server.",
  },
})

const resolveBinaryName = (pkgJson: PackageJson): string => {
  const binField = pkgJson.bin

  if (typeof binField === "string" && pkgJson.name) {
    return pkgJson.name
  }

  if (binField && typeof binField === "object") {
    const [firstKey] = Object.keys(binField)
    if (firstKey) {
      return firstKey
    }
  }

  throw new Error("Binary name could not be determined from package.json")
}

const require = createRequire(import.meta.url)
const pkg = require("../../package.json") as PackageJson

const APP = buildApplication(COMMAND_ROUTES, {
  name: resolveBinaryName(pkg),
  versionInfo: {
    currentVersion: pkg.version ?? "0.0.0",
  },
  scanner: {
    caseStyle: "allow-kebab-for-camel",
  },
  documentation: {
    caseStyle: "convert-camel-to-kebab",
  },
})

const MAIN = async (): Promise<void> => {
  try {
    await run(APP, process.argv.slice(2), { process })
  } catch (error) {
    cliLogger.error("Fatal error in CLI execution", error)
    process.exitCode = 1
  }
}

MAIN().catch((error) => {
  cliLogger.error("Error occurred during CLI startup", error)
  process.exitCode = 1
})
