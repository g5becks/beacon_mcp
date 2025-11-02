---
id: task-001.27
title: Implement concurrency handling for multi-process safety
status: Done
assignee: []
created_date: '2025-11-01 16:31'
updated_date: '2025-11-02 21:05'
labels:
  - concurrency
  - database
  - architecture
dependencies:
  - task-001.08
parent_task_id: task-001
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add concurrency handling to prevent conflicts when multiple MCP server instances access the same DuckDB file.

**Problem:** DuckDB doesn't support multi-process writes automatically. Multiple Claude Code instances = multiple MCP servers = write conflicts.

**Solution (v1 - Append-Only + Retry):**

1. **Append-only design**
   - Most operations (storeKnowledge) are INSERT operations
   - DuckDB guarantees: appends never conflict
   - Fits knowledge management: rules/decisions are mostly immutable

2. **Optimistic retry for updates**
   - Wrap updateKnowledge() and deleteKnowledge() in retry logic
   - Catch conflict errors and retry with exponential backoff
   - Maximum 3 retries with 100ms, 200ms, 400ms delays

3. **Transaction conflict detection**
   - Detect "Conflict" or "transaction conflict" in error messages
   - Log conflicts for monitoring
   - Return clear error after max retries

4. **Documentation**
   - Document that heavy concurrent updates may conflict
   - Recommend append-only patterns
   - Note that reads never conflict

**Future enhancement (v2):**
- HTTP transport with single daemon server
- See IMPLEMENTATION_PLAN_TS.md for details

**Reference:** https://duckdb.org/docs/stable/connect/concurrency
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Install proper-lockfile and @types/proper-lockfile dependencies
- [ ] #2 Use createRequire to import proper-lockfile in ESM modules
- [ ] #3 Wrap all write operations (store, update, delete) with file locks
- [ ] #4 Configure lock options: stale=10000ms, retries=3
- [ ] #5 Read operations do not use locks (concurrent reads are safe)
- [ ] #6 Lock release happens in finally blocks to prevent orphaned locks

- [ ] #7 Lock path uses database file path
- [ ] #8 Error handling for lock acquisition failures
- [ ] #9 Documentation explains when locks are used and why
<!-- AC:END -->
