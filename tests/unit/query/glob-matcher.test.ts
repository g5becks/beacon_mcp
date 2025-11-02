import assert from "node:assert/strict"
import test from "node:test"

import { convertGlobToLike, matchGlob } from "../../../src/query/glob-matcher.js"

test("matchGlob supports recursive wildcard patterns", () => {
  assert.equal(matchGlob("**/*.ts", "/src/app.ts"), true)
  assert.equal(matchGlob("**/*.ts", "/src/components/Button.ts"), true)
  assert.equal(matchGlob("**/*.ts", "/src/styles.css"), false)
})

test("matchGlob handles negated patterns", () => {
  assert.equal(matchGlob("!**/*.spec.ts", "/tests/example.spec.ts"), false)
  assert.equal(matchGlob("!**/*.spec.ts", "/tests/example.ts"), true)
})

test("matchGlob normalizes leading slashes", () => {
  assert.equal(matchGlob("src/**/*.ts", "/src/utils/fs.ts"), true)
  assert.equal(matchGlob("/src/**/*.ts", "src/utils/fs.ts"), true)
})

test("convertGlobToLike converts wildcards to SQL LIKE patterns", () => {
  assert.equal(convertGlobToLike("/src/**/*.ts"), "/src/%/%.ts")
  assert.equal(convertGlobToLike("/docs/*.md"), "/docs/%.md")
  assert.equal(convertGlobToLike("**"), "/%")
})

test("convertGlobToLike escapes SQL wildcard characters", () => {
  assert.equal(convertGlobToLike("/data/_temp/*.json"), "/data/\\_temp/%.json")
})
