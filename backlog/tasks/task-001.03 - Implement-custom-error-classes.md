---
id: task-001.03
title: Implement custom error classes
status: Done
assignee: []
created_date: '2025-11-01 15:54'
updated_date: '2025-11-01 18:27'
labels:
  - error-handling
  - foundation
dependencies:
  - task-001.01
parent_task_id: task-001
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create custom error classes with error codes and context for better debugging and error handling throughout the application.

**File to create:** src/types/errors.ts

**Error classes to implement:**
- BeaconError (base class with code and cause)
- PluginInitError
- PluginDependencyError
- ConfigError
- ValidationError
- DatabaseError
- QueryError

**Reference:** See IMPLEMENTATION_PLAN_TS.md section "Custom Error Types"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All error classes extend BeaconError base class
- [ ] #2 Each error includes error code and optional cause
- [ ] #3 Error.captureStackTrace called in constructors
- [ ] #4 Error messages are descriptive and include context
<!-- AC:END -->
