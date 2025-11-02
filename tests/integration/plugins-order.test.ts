import assert from "node:assert/strict"
import os from "node:os"
import test from "node:test"
import pino from "pino"

import { databasePlugin } from "../../src/plugins/database.js"
import { queryEnginePlugin } from "../../src/plugins/query-engine.js"
import type { ApplicationContext } from "../../src/types/app-context.js"
import type { ResolvedConfig } from "../../src/types/config.js"
import { PluginDependencyError, PluginInitError } from "../../src/types/errors.js"

const baseContext = (): ApplicationContext => ({
  name: "beacon-test",
  version: "1.0.0",
  isReady: false,
})

const testConfig: ResolvedConfig = {
  projectName: "beacon-test",
  projectRoot: os.tmpdir(),
  baseDir: os.tmpdir(),
  projectDir: os.tmpdir(),
  databasePath: ":memory:",
  logsDir: os.tmpdir(),
  environment: "testing",
  logLevel: "silent",
  dotenvFiles: [],
}

test("database plugin enforces configuration dependency", async () => {
  const context = baseContext()
  await assert.rejects(databasePlugin(context), PluginDependencyError)
})

test("query engine plugin requires database and logger", () => {
  const context = baseContext()
  context.logger = pino({ level: "silent" })
  assert.throws(() => queryEnginePlugin(context), PluginInitError)
})

test("plugins initialize successfully in dependency order", async (t) => {
  const context = baseContext()
  context.config = testConfig
  context.logger = pino({ level: "silent" })

  await databasePlugin(context)
  t.after(async () => {
    await context.database?.dispose()
  })

  await queryEnginePlugin(context)

  assert.ok(context.database, "database should be registered")
  assert.ok(context.queryEngine, "query engine should be registered")
})
