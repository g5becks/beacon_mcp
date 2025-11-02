---
id: task-001.10
title: Implement path resolver with ancestor calculation
status: Done
assignee: []
created_date: '2025-11-01 15:56'
updated_date: '2025-11-02 04:12'
labels:
  - query
  - core
dependencies:
  - task-001.01
parent_task_id: task-001
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the path hierarchy resolver that calculates ancestor paths for hierarchical knowledge retrieval.

**File to create:** src/query/PathResolver.ts

**Function to implement:**
- getPathAncestors(filePath: string): string[]
  - Normalize path separators
  - Split into components
  - Build ancestor list from root to file
  - Always include "." (root)

**Example:** "src/server/api/users.ts" → [".", "src", "src/server", "src/server/api", "src/server/api/users.ts"]

**Reference:** See IMPLEMENTATION_PLAN_TS.md section "Path Resolver"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 getPathAncestors returns correct ancestor list
- [ ] #2 Root path (.) always included
- [ ] #3 Handles both forward and backward slashes
- [ ] #4 Handles edge cases (empty string, single file, nested paths)
- [ ] #5 Function is pure (no side effects)
<!-- AC:END -->
