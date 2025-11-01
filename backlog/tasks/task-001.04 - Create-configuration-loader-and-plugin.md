---
id: task-001.04
title: Create configuration loader and plugin
status: To Do
assignee: []
created_date: '2025-11-01 15:54'
labels:
  - plugin
  - configuration
dependencies:
  - task-001.02
  - task-001.03
parent_task_id: task-001
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement configuration loading system and the first Avvio plugin.

**Files to create:**
- src/config/loader.ts - Configuration loading logic
- src/plugins/config.ts - Configuration plugin registration

**Functionality:**
- Load configuration from environment variables and defaults
- Resolve paths (database location, logs directory)
- Environment detection (development/testing/production)
- Export ResolvedConfig type

**Reference:** See IMPLEMENTATION_PLAN_TS.md "Plugin Pattern" section and dfm_src/src/plugins/config.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Config plugin loads without errors
- [ ] #2 Configuration has sensible defaults
- [ ] #3 Environment variables override defaults
- [ ] #4 Paths are resolved to absolute paths
- [ ] #5 Plugin throws PluginInitError on failure
<!-- AC:END -->
