import assert from "node:assert/strict"
import test from "node:test"

import { getPathAncestors } from "../../../src/query/path-resolver.js"

test("getPathAncestors returns root for empty input", () => {
  assert.deepEqual(getPathAncestors(""), ["/"])
  assert.deepEqual(getPathAncestors("   "), ["/"])
})

test("getPathAncestors normalizes relative paths", () => {
  assert.deepEqual(getPathAncestors("src/api"), ["/", "/src", "/src/api"])
})

test("getPathAncestors handles absolute unix paths", () => {
  assert.deepEqual(getPathAncestors("/src/api/routes"), [
    "/",
    "/src",
    "/src/api",
    "/src/api/routes",
  ])
})

test("getPathAncestors handles windows style paths", () => {
  assert.deepEqual(getPathAncestors("C:\\foo\\bar"), [
    "/",
    "/C:",
    "/C:/foo",
    "/C:/foo/bar",
  ])
})

test("getPathAncestors collapses redundant separators", () => {
  assert.deepEqual(getPathAncestors("//src///api///users"), [
    "/",
    "/src",
    "/src/api",
    "/src/api/users",
  ])
})
