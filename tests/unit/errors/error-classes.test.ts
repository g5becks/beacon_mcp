import assert from "node:assert/strict"
import test from "node:test"

import {
  BeaconError,
  ConcurrencyError,
  KnowledgeNotFoundError,
  LockAcquisitionError,
  ValidationError,
} from "../../../src/types/errors.js"

test("ValidationError extends BeaconError with correct code", () => {
  const error = new ValidationError("Invalid input", { field: "path" })
  assert.ok(error instanceof BeaconError)
  assert.equal(error.code, "INVALID_INPUT")
  assert.match(error.toMCPMessage(), /INVALID_INPUT: Invalid input/)
})

test("KnowledgeNotFoundError formats message by identifier type", () => {
  const idError = new KnowledgeNotFoundError("1234", "id")
  const pathError = new KnowledgeNotFoundError("/rules", "path")

  assert.equal(
    idError.message,
    "Knowledge entry not found with ID: 1234"
  )
  assert.equal(
    pathError.message,
    "Knowledge entry not found at path: /rules"
  )
})

test("Concurrency and lock errors carry custom codes", () => {
  const concurrency = new ConcurrencyError("Conflict detected", {
    retries: 3,
  })
  const lock = new LockAcquisitionError("Could not acquire lock")

  assert.equal(concurrency.code, "CONCURRENCY_ERROR")
  assert.equal(lock.code, "LOCK_ACQUISITION_ERROR")
  assert.ok(concurrency.details)
  assert.equal(lock.details?.cause, undefined)
})
