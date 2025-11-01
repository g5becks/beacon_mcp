---
id: task-001
title: 'Implement Beacon MCP: Path-based Knowledge Management Server'
status: To Do
assignee: []
created_date: '2025-11-01 15:50'
labels:
  - feature
  - mcp-server
  - architecture
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a production-ready MCP server for path-based knowledge management using TypeScript, DuckDB, and Avvio plugin architecture. This server enables AI assistants to retrieve hierarchical knowledge (rules, decisions, documentation) based on file paths in software projects.

**Business Value:**
- Provides Claude Code with location-aware context for better code generation
- Enables teams to document project-specific rules and decisions
- Fast retrieval using path hierarchy and full-text search
- Zero external dependencies (embedded DuckDB)

**Architecture:**
- Avvio plugin-based lifecycle management
- DuckDB storage with FTS extension
- Stricli type-safe CLI
- MCP protocol via stdio transport

**Reference:** See IMPLEMENTATION_PLAN_TS.md for complete technical specification.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 MCP server starts via CLI and responds to tool calls
- [ ] #2 Knowledge can be stored with type (rule/decision/doc), path, and content
- [ ] #3 Path-based search returns knowledge from ancestor paths
- [ ] #4 Full-text search works with BM25 scoring
- [ ] #5 CLI commands work for serve, store, search, list operations
- [ ] #6 All plugins load in correct dependency order with proper error handling
- [ ] #7 Database transactions maintain ACID properties
- [ ] #8 Unit tests cover core functionality with >80% coverage
<!-- AC:END -->
