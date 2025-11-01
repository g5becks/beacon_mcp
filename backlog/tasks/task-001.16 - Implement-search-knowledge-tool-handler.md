---
id: task-001.16
title: Implement search-knowledge tool handler
status: To Do
assignee: []
created_date: '2025-11-01 15:56'
labels:
  - mcp
  - tools
  - search
dependencies:
  - task-001.14
  - task-001.13
parent_task_id: task-001
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the handler for the search-knowledge MCP tool that performs path-based and content-based searches.

**Functionality:**
- Support path-based search (with hierarchy)
- Support content-based search (FTS)
- Support hybrid search (path + content)
- Filter by type (rule/decision/doc)
- Return formatted results with scores
- Limit results (default 20)

**Reference:** See IMPLEMENTATION_PLAN_TS.md MCP Server Implementation section
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tool supports path-based search using hierarchy
- [ ] #2 Tool supports FTS content search
- [ ] #3 Tool supports filtering by type
- [ ] #4 Tool returns results with relevance scores
- [ ] #5 Tool respects limit parameter
- [ ] #6 Tool formats results as markdown
<!-- AC:END -->
