---
id: task-001.11
title: Implement glob pattern matcher
status: Done
assignee: []
created_date: '2025-11-01 15:56'
updated_date: '2025-11-02 12:23'
labels:
  - query
  - matching
dependencies:
  - task-001.01
parent_task_id: task-001
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a glob pattern matcher for filtering knowledge items by path patterns.

**File to create:** src/query/GlobMatcher.ts

**Functions to implement:**
- matchGlob(pattern: string, path: string): boolean
- convertGlobToLike(pattern: string): string (for SQL LIKE queries)

**Patterns to support:**
- Wildcards: * (any chars), ? (single char)
- Path separators: / and **
- Negation: ! prefix

**Reference:** See IMPLEMENTATION_PLAN_TS.md section "Glob Pattern Matching"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Glob patterns correctly match paths
- [ ] #2 Wildcards (* and ?) work correctly
- [ ] #3 Negation (!) works correctly
- [ ] #4 convertGlobToLike produces valid SQL LIKE patterns
- [ ] #5 Edge cases handled (empty pattern, special chars)
<!-- AC:END -->
