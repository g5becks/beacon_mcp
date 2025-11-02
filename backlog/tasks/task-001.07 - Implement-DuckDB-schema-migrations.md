---
id: task-001.07
title: Implement DuckDB schema migrations
status: Done
assignee: []
created_date: '2025-11-01 15:56'
updated_date: '2025-11-02 01:12'
labels:
  - database
  - schema
dependencies:
  - task-001.06
parent_task_id: task-001
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the database schema initialization with tables, indexes, and FTS configuration.

**File to create:** src/storage/migrations.ts

**Schema to create:**
- knowledge table (id, type, path, scope, content, etc.)
- Indexes on type, path, library
- FTS index configuration with Porter stemming

**Reference:** See IMPLEMENTATION_PLAN_TS.md section "DuckDB Schema Migrations"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Knowledge table created with all required columns
- [ ] #2 CHECK constraints enforce valid types and scopes
- [ ] #3 Indexes created on type, path, and library columns
- [ ] #4 FTS index configured with Porter stemming and English stopwords
- [ ] #5 initializeSchema function is idempotent (safe to run multiple times)
<!-- AC:END -->
