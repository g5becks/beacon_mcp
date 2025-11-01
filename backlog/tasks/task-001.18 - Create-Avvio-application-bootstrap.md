---
id: task-001.18
title: Create Avvio application bootstrap
status: To Do
assignee: []
created_date: '2025-11-01 15:56'
labels:
  - core
  - architecture
dependencies:
  - task-001.04
  - task-001.05
  - task-001.09
  - task-001.13
  - task-001.17
parent_task_id: task-001
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the main application bootstrap file that sets up Avvio and registers all plugins in dependency order.

**File to create:** src/app.ts

**Functions to implement:**
- createApp() - Create Avvio instance with lifecycle hooks
- startApp(cliConfig) - Register plugins and start application

**Plugin registration order:**
1. configPlugin
2. loggerPlugin
3. databasePlugin
4. queryEnginePlugin
5. mcpServerPlugin

**Reference:** See IMPLEMENTATION_PLAN_TS.md section "Application Bootstrap Pattern"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 createApp initializes Avvio with correct configuration
- [ ] #2 startApp registers plugins in correct dependency order
- [ ] #3 Lifecycle events (start, preReady, ready) fire correctly
- [ ] #4 Application startup errors are caught and logged
- [ ] #5 app.ready() completes without errors
- [ ] #6 Fully initialized ApplicationContext is returned
<!-- AC:END -->
