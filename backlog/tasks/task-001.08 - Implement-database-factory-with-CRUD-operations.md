---
id: task-001.08
title: Implement database factory with CRUD operations
status: Done
assignee: []
created_date: '2025-11-01 15:56'
updated_date: '2025-11-02 03:37'
labels:
  - database
  - core
dependencies:
  - task-001.07
parent_task_id: task-001
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the database factory function that returns a Database interface implementation with all CRUD operations.

**File to create:** src/storage/database.ts

**Functions to implement:**
- createDatabase() - Factory function
- storeKnowledgeImpl() - Insert with transactions
- getKnowledgeImpl() - Retrieve by ID
- updateKnowledgeImpl() - Update existing record
- deleteKnowledgeImpl() - Delete by ID
- searchByPathImpl() - Path hierarchy search
- searchByContentImpl() - FTS search
- listKnowledgeImpl() - List all/filtered
- rowToKnowledge() - Convert DB row to Knowledge type

**Reference:** See IMPLEMENTATION_PLAN_TS.md section "Database Implementation" and dfm_src/src/plugins/database.ts pattern
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 createDatabase returns Database interface
- [ ] #2 All CRUD operations work correctly
- [ ] #3 Transactions rollback on errors
- [ ] #4 searchByPath uses path hierarchy
- [ ] #5 searchByContent uses FTS with BM25 scoring
- [ ] #6 Database connection can be properly disposed
- [ ] #7 All operations log appropriately
<!-- AC:END -->
