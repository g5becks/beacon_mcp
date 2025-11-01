---
id: task-001.24
title: Write unit tests for core modules
status: To Do
assignee: []
created_date: '2025-11-01 15:57'
labels:
  - testing
  - quality
dependencies:
  - task-001.10
  - task-001.11
  - task-001.12
  - task-001.03
parent_task_id: task-001
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create comprehensive unit tests for core modules with high coverage.

**Modules to test:**
- PathResolver (getPathAncestors)
- GlobMatcher (matchGlob, convertGlobToLike)
- QueryBuilder (fluent API, SQL generation)
- Custom error classes
- Type validators

**Test framework:** Use Vitest or Jest

**Target:** >80% code coverage for core modules
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Unit tests for PathResolver cover all edge cases
- [ ] #2 Unit tests for GlobMatcher cover pattern variations
- [ ] #3 Unit tests for QueryBuilder test SQL generation
- [ ] #4 Unit tests for error classes verify proper inheritance
- [ ] #5 All tests pass
- [ ] #6 Coverage is >80% for tested modules
<!-- AC:END -->
