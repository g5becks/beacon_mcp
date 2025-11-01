---
id: task-001.25
title: Write integration tests
status: To Do
assignee: []
created_date: '2025-11-01 15:57'
labels:
  - testing
  - integration
dependencies:
  - task-001.18
  - task-001.20
parent_task_id: task-001
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create integration tests that test the full stack with real DuckDB database.

**Test scenarios:**
- Store and retrieve knowledge
- Path hierarchy search
- Full-text search
- Plugin initialization order
- Error handling
- Database transactions

**Use in-memory DuckDB for fast tests**
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Integration tests use in-memory DuckDB
- [ ] #2 Tests cover full CRUD operations
- [ ] #3 Tests verify path hierarchy search works correctly
- [ ] #4 Tests verify FTS search with BM25 scoring
- [ ] #5 Tests verify plugin initialization in correct order
- [ ] #6 All integration tests pass
<!-- AC:END -->
