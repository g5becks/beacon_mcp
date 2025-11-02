import assert from "node:assert/strict"
import test from "node:test"
import pino from "pino"

import { createDatabase } from "../../src/storage/database.js"

const createTestDatabase = () =>
  createDatabase({
    location: ":memory:",
    environment: "testing",
    logger: pino({ level: "silent" }),
  })

test("database CRUD round trip", async (t) => {
  const db = await createTestDatabase()
  t.after(async () => {
    await db.dispose()
  })

  const stored = await db.storeKnowledge({
    type: "rule",
    path: "/src/app",
    title: "Test Rule",
    content: "Always test code",
    metadata: { library: "jest" },
  })

  assert.equal(stored.title, "Test Rule")

  const fetched = await db.getKnowledge(stored.id)
  assert.ok(fetched)
  assert.equal(fetched?.content, "Always test code")

  const updated = await db.updateKnowledge(stored.id, {
    title: "Updated Rule",
  })
  assert.equal(updated.title, "Updated Rule")

  const listed = await db.listKnowledge()
  assert.equal(listed.length, 1)

  await db.deleteKnowledge(stored.id)
  const afterDelete = await db.getKnowledge(stored.id)
  assert.equal(afterDelete, null)
})
