---
id: task-001.12
title: Implement SQL query builder
status: Done
assignee: []
created_date: '2025-11-01 15:56'
updated_date: '2025-11-02 12:47'
labels:
  - query
  - sql
dependencies:
  - task-001.02
parent_task_id: task-001
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a fluent query builder for constructing DuckDB SQL queries with filters, ordering, and limits.

**File to create:** src/query/QueryBuilder.ts

**QueryBuilder class methods:**
- where(filter: QueryFilter): this
- orderBy(field: string, direction: 'ASC' | 'DESC'): this
- limit(count: number): this
- build(): { sql: string; params: any[] }
- buildWithScore(): { sql: string; params: any[] } (for FTS queries)

**Reference:** See IMPLEMENTATION_PLAN_TS.md section "Query Builder"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 QueryBuilder supports fluent chaining
- [ ] #2 Generates valid parameterized SQL queries
- [ ] #3 Supports filtering by type, path, library
- [ ] #4 Supports FTS content queries
- [ ] #5 buildWithScore includes BM25 score calculation
- [ ] #6 Prevents SQL injection through parameterization
<!-- AC:END -->
