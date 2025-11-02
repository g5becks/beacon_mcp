import assert from "node:assert/strict"
import test from "node:test"

import { QueryBuilder } from "../../../src/query/query-builder.js"

test("QueryBuilder builds simple equality query", () => {
  const builder = new QueryBuilder()
  const { sql, params } = builder.whereEquals("type", "decision").build()

  assert.equal(sql, "SELECT knowledge.* FROM knowledge WHERE knowledge.type = ?")
  assert.deepEqual(params, ["decision"])
})

test("QueryBuilder expands ancestor paths when requested", () => {
  const builder = new QueryBuilder()
  const { sql, params } = builder
    .wherePath("/src/app/components/Button.tsx", true)
    .build()

  assert.equal(
    sql,
    "SELECT knowledge.* FROM knowledge WHERE knowledge.path IN (?,?,?,?,?)"
  )
  assert.deepEqual(params, [
    "/",
    "/src",
    "/src/app",
    "/src/app/components",
    "/src/app/components/Button.tsx",
  ])
})

test("QueryBuilder converts glob filters to LIKE clauses", () => {
  const builder = new QueryBuilder()
  const { sql, params } = builder.whereGlob("/docs/**/*.md").build()

  assert.equal(
    sql,
    "SELECT knowledge.* FROM knowledge WHERE knowledge.path LIKE ? ESCAPE '\\'"
  )
  assert.deepEqual(params, ["/docs/%/%.md"])
})

test("QueryBuilder supports full text filters with scoring", () => {
  const builder = new QueryBuilder()
  builder.whereFullText("duckdb", 0.5)
  const { sql, params } = builder.buildWithScore()

  assert.equal(
    sql,
    "SELECT knowledge.*, fts_main_knowledge.match_bm25(knowledge.id, ?) AS score FROM knowledge WHERE fts_main_knowledge.match_bm25(knowledge.id, ?) >= ?"
  )
  assert.deepEqual(params, ["duckdb", "duckdb", 0.5])
})

test("QueryBuilder buildWithScore throws without full-text clause", () => {
  const builder = new QueryBuilder()
  assert.throws(() => builder.buildWithScore(), /Full-text clause required/)
})
