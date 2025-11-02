---
id: task-001.09
title: Create database plugin
status: Done
assignee: []
created_date: '2025-11-01 15:56'
updated_date: '2025-11-02 03:53'
labels:
  - plugin
  - database
dependencies:
  - task-001.08
parent_task_id: task-001
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the database plugin that integrates the database factory into the Avvio plugin system.

**File to create:** src/plugins/database.ts

**Plugin responsibilities:**
- Check for app.config and app.logger dependencies
- Call createDatabase() with configuration
- Add database to app.database
- Handle initialization errors properly

**Reference:** See IMPLEMENTATION_PLAN_TS.md section "Plugin Pattern"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Plugin checks for config and logger dependencies
- [ ] #2 Plugin throws PluginDependencyError if dependencies missing
- [ ] #3 Database is properly initialized and added to app context
- [ ] #4 Plugin throws PluginInitError on database creation failure
- [ ] #5 Success message logged after initialization
<!-- AC:END -->
