---
id: task-001.20
title: Implement serve command
status: Done
assignee: []
created_date: '2025-11-01 15:56'
updated_date: '2025-11-02 17:50'
labels:
  - cli
  - command
dependencies:
  - task-001.19
parent_task_id: task-001
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the serve command that starts the MCP server using the Avvio application.

**File to create:** src/cli/commands/serve.ts

**Command functionality:**
- Call startApp() to initialize all plugins
- Start MCP server (app.server.start())
- Handle SIGINT for graceful shutdown
- Log server status

**Reference:** See IMPLEMENTATION_PLAN_TS.md section "Serve Command"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Command starts application successfully
- [ ] #2 MCP server starts and listens on stdio
- [ ] #3 SIGINT triggers graceful shutdown
- [ ] #4 Appropriate status messages logged
- [ ] #5 Command exits with code 0 on success, 1 on failure
<!-- AC:END -->
