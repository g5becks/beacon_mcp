---
id: task-001.27
title: Implement concurrency handling for multi-process safety
status: To Do
assignee: []
created_date: '2025-11-01 16:31'
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
- [ ] #1 Update and delete operations use retry logic with exponential backoff
- [ ] #2 Transaction conflicts are detected and handled gracefully
- [ ] #3 Maximum 3 retries with configurable delays
- [ ] #4 Insert operations (storeKnowledge) work without retry (appends never conflict)
- [ ] #5 Conflict errors are logged with context
- [ ] #6 Documentation explains concurrency model and limitations
<!-- AC:END -->
