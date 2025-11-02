---
id: task-001.17
title: Create MCP server plugin
status: Done
assignee: []
created_date: '2025-11-01 15:56'
updated_date: '2025-11-02 16:31'
labels:
  - plugin
  - mcp
dependencies:
  - task-001.15
  - task-001.16
parent_task_id: task-001
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the MCP server plugin that integrates the MCP server into the Avvio plugin system.

**File to create:** src/plugins/server.ts

**Plugin responsibilities:**
- Check for database, queryEngine, and logger dependencies
- Initialize MCP server with stdio transport
- Register all tool handlers
- Provide start/stop methods
- Handle initialization errors

**Reference:** See IMPLEMENTATION_PLAN_TS.md Plugin Pattern and dfm_src/src/plugins/server.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Plugin checks for all required dependencies
- [ ] #2 MCP server initialized with correct configuration
- [ ] #3 All tool handlers registered
- [ ] #4 Plugin provides start() and stop() methods on app.server
- [ ] #5 Plugin logs initialization status
- [ ] #6 Plugin throws appropriate errors on failure
<!-- AC:END -->
