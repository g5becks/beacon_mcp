import assert from "node:assert/strict"
import test from "node:test"
import { ZodError } from "zod"

import {
  KnowledgePathSchema,
  KnowledgeTypeSchema,
} from "../../../src/types/knowledge.js"

test("KnowledgeTypeSchema accepts known types", () => {
  assert.equal(KnowledgeTypeSchema.parse("rule"), "rule")
  assert.equal(KnowledgeTypeSchema.parse("decision"), "decision")
  assert.equal(KnowledgeTypeSchema.parse("details"), "details")
})

test("KnowledgeTypeSchema rejects invalid values", () => {
  assert.throws(() => KnowledgeTypeSchema.parse("unknown"), ZodError)
})

test("KnowledgePathSchema enforces formatting rules", () => {
  assert.equal(KnowledgePathSchema.parse("/src/app"), "/src/app")
  assert.throws(() => KnowledgePathSchema.parse("src/no-leading"), ZodError)
  assert.throws(() => KnowledgePathSchema.parse("/invalid path"), ZodError)
})
