import assert from "node:assert/strict"
import test from "node:test"
import pino from "pino"

import { QueryBuilder } from "../../src/query/query-builder.js"
import { createDatabase } from "../../src/storage/database.js"

const createTestDatabase = () =>
  createDatabase({
    location: ":memory:",
    environment: "testing",
    logger: pino({ level: "silent" }),
  })

test("path search returns ancestor hierarchy", async (t) => {
  const db = await createTestDatabase()
  t.after(async () => {
    await db.dispose()
  })

  await db.storeKnowledge({
    type: "rule",
    path: "/",
    title: "Root",
    content: "Root rule",
  })

  await db.storeKnowledge({
    type: "rule",
    path: "/src",
    title: "Src",
    content: "Src rule",
  })

  await db.storeKnowledge({
    type: "rule",
    path: "/src/api",
    title: "API",
    content: "API rule",
  })

  const results = await db.searchByPath({
    path: "/src/api/users/index.ts",
    includeAncestors: true,
    sortBy: "path",
  })

  assert.equal(results.total, 3)
  assert.deepEqual(
    results.entries.map((entry) => entry.path),
    ["/", "/src", "/src/api"]
  )
})

test("full-text search builds BM25-scored query", async (t) => {
  const db = await createTestDatabase()
  t.after(async () => {
    await db.dispose()
  })

  await db.storeKnowledge({
    type: "details",
    path: "/docs/duckdb",
    title: "DuckDB overview",
    content: "DuckDB is an in-process analytics database engine",
    metadata: { library: "duckdb" },
  })

  await db.storeKnowledge({
    type: "details",
    path: "/docs/fs",
    title: "Filesystem overview",
    content: "Node.js filesystem API",
    metadata: { library: "fs" },
  })

  const search = await db.searchByContent({ content: "duckdb", limit: 5 })
  assert.equal(search.query?.content, "duckdb")

  const builder = new QueryBuilder()
  builder.whereFullText("duckdb")
  const plan = builder.buildWithScore()

  assert.ok(plan.sql.includes("match_bm25"))
  assert.equal(plan.params[0], "duckdb")
})
