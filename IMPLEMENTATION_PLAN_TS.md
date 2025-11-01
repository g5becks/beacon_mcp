# Path-Based Knowledge Server Design Document

**Project Name:** `beacon-mcp` (working title)
**Version:** 1.0.0
**Language:** TypeScript
**Runtime:** Node.js 20+
**Storage:** DuckDB (embedded analytics database with FTS)
**Purpose:** Hierarchical, path-based knowledge storage for software development projects
**Target Use Case:** AI-assisted development with Claude Code, Task Master MCP, and similar tools

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Core Concepts](#core-concepts)
4. [Architecture Overview](#architecture-overview)
5. [Knowledge Types](#knowledge-types)
6. [Data Models](#data-models)
7. [Project Structure](#project-structure)
8. [Storage Layer](#storage-layer)
9. [Query Engine](#query-engine)
10. [MCP Server Implementation](#mcp-server-implementation)
11. [CLI Implementation](#cli-implementation)
12. [User Workflows](#user-workflows)
13. [Use Cases](#use-cases)
14. [Implementation Phases](#implementation-phases)
15. [Performance Considerations](#performance-considerations)
16. [Security & Validation](#security--validation)

---

## Executive Summary

### What is Beacon MCP?

Beacon MCP is a specialized knowledge management server designed for software development projects. Unlike traditional RAG (Retrieval-Augmented Generation) systems that rely on semantic search and vector embeddings, Beacon MCP uses **hierarchical path-based retrieval** to organize and retrieve knowledge based on where it applies in a project's file tree.

### The Core Insight

Software project knowledge is inherently **tree-based, not graph-based**:

- **Rules** apply to specific paths, files, functions, or even line ranges
- **Decisions** affect specific subtrees of the codebase
- **Documentation** captures how your codebase implements patterns and uses libraries (not library docs themselves)

### Why Not Traditional RAG?

Traditional RAG systems excel at:
- ✅ Finding semantically similar content across large, unstructured datasets
- ✅ Answering questions about general knowledge
- ✅ Cross-cutting concept searches

But they struggle with:
- ❌ "What rules apply to THIS file?" (location-based queries)
- ❌ Hierarchical inheritance (parent rules applying to children)
- ❌ Deterministic, predictable results
- ❌ Simplicity and zero external dependencies

### What Problem Does This Solve?

When an AI agent (like Claude Code) works on a file like `src/server/services/alerts/email.ts`, it needs to know:

1. **Global project rules** (apply everywhere)
2. **Server-specific rules** (apply to `src/server/*`)
3. **Service-layer rules** (apply to `src/server/services/*`)
4. **Alert-specific rules** (apply to `src/server/services/alerts/*`)
5. **File-specific rules** (apply only to this file)

Traditional RAG would require:
- Embedding the query
- Semantic search across all rules
- Hope the relevant ones come back
- Non-deterministic results
- External API dependencies (OpenAI, Cohere, etc.)

Beacon MCP:
- Instant SQL path hierarchy query
- **Deterministic**: same file → same rules, every time
- Zero external dependencies
- Simple mental model developers already understand

---

## Problem Statement

### The RAG Mismatch

During the development of `nanorag-mcp` (the RAG-based knowledge server), we discovered a fundamental mismatch:

**What we built:** A tag-based semantic search system using embeddings, FTS5, classifier, and hybrid search with RRF merging.

**What we actually needed:** A simple way to retrieve knowledge based on file location in the project tree.

### The Epiphany

The realization came when analyzing the types of knowledge stored in a software project:

| Knowledge Type | Current (RAG) Approach | What We Actually Need |
|----------------|----------------------|---------------------|
| **Rules** | Semantic search by tags | Path/glob/scope matching: "all rules for this path and ancestors" |
| **Decisions** | Semantic search by tags | Path hierarchy: "decisions affecting this subtree" |
| **Documentation** | Semantic search by tags | Path-based: "How we use TypeBox in `core/types/`" |

### The Aha Moment

> "Knowledge isn't categorized by concepts (tags), it's **scoped by location** (paths)."

A rule about "always validate input" isn't just a rule about "validation" (tag-based thinking). It's a rule that applies to `src/server/api/**/*` and everything beneath it (path-based thinking).

### Why This Deserves Its Own Server

Initially, we considered extending `nanorag-mcp` to support both approaches:
- Path-based retrieval for rules/decisions
- RAG for docs/domain knowledge

**However:**

1. **Different core value propositions**
   - `nanorag-mcp`: Token-efficient semantic search for domain knowledge and large documentation
   - `beacon-mcp`: Hierarchical context injection for location-specific knowledge (rules, decisions, codebase patterns)

2. **Different dependencies**
   - `nanorag-mcp`: Requires embedding APIs, classifier, vector storage (SQLite + vec0)
   - `beacon-mcp`: Zero external dependencies, just DuckDB (embedded database)

3. **Different mental models**
   - `nanorag-mcp`: "Search for knowledge about X" (concepts, domain models)
   - `beacon-mcp`: "What applies to this file/function/line?" (location-based)

4. **Separation of concerns**
   - Each server focused on one specialized task
   - Simpler to understand, maintain, and evolve
   - Users can use one or both depending on needs

---

## Storage Technology: Why DuckDB?

### Decision Rationale

Beacon MCP uses **DuckDB** (https://duckdb.org/) as its storage and indexing layer.

### Why DuckDB Over Alternatives?

**Considered Alternatives:**
1. **SQLite + FTS5** - Embedded SQL database with full-text search
2. **PostgreSQL** - Full-featured database (too heavy for embedded use)
3. **In-memory JSON** - Simple but no persistence or complex queries

**Why DuckDB Wins:**

1. **Embedded Analytics Database**
   - DuckDB designed for embedded analytics workloads
   - Zero-configuration, single-file database
   - No server process needed
   - Perfect for development tools

2. **SQL + Full-Text Search**
   - Familiar SQL query language (everyone knows SQL)
   - Built-in FTS extension for full-text search
   - No need to learn custom query DSL
   - Powerful WHERE clauses for path filtering

3. **Performance**
   - Optimized for OLAP (analytical) queries
   - Vectorized query execution
   - Columnar storage for fast aggregations
   - Beacon MCP is read-heavy (perfect fit)

4. **TypeScript Integration**
   - Official `@duckdb/node-api` package
   - Native async/await support
   - Type-safe value handling
   - Lossless data type conversion

5. **Zero External Dependencies**
   - No embedding APIs needed
   - No vector database needed
   - No Python/C++ runtime needed
   - Pure Node.js integration

6. **Advanced Features Built-In**
   - **JSON support**: Store references as JSON
   - **Parameterized queries**: Prevent SQL injection
   - **Transactions**: ACID compliance
   - **Aggregations**: GROUP BY, COUNT, etc.
   - **Window functions**: For advanced queries

### DuckDB's Strengths for Beacon MCP

**Perfect Fit for Beacon MCP Use Cases:**

1. **Hierarchical Path Queries**
   ```typescript
   // Find all rules for path "src/server/api/users.ts"
   const ancestors = getPathAncestors('src/server/api/users.ts');
   // ['.', 'src', 'src/server', 'src/server/api', 'src/server/api/users.ts']

   const rules = await conn.runAndReadAll(`
     SELECT * FROM knowledge
     WHERE type = 'rule'
       AND path IN (${ancestors.map(() => '?').join(',')})
     ORDER BY length(path)
   `, ancestors);
   ```

2. **Glob Pattern Matching**
   ```typescript
   // Find all knowledge for test files
   const result = await conn.runAndReadAll(`
     SELECT * FROM knowledge
     WHERE path LIKE '%test.ts'
   `);
   ```

3. **Full-Text Search with FTS Extension**
   ```typescript
   // Create FTS index
   await conn.run(`
     PRAGMA create_fts_index(
       'knowledge',
       'id',
       'title',
       'content',
       stemmer = 'porter'
     )
   `);

   // Search with BM25 scoring
   const results = await conn.runAndReadAll(`
     SELECT k.*, fts_main_knowledge.match_bm25(k.id, ?) as score
     FROM knowledge k
     WHERE score IS NOT NULL
     ORDER BY score DESC
   `, ['validation JWT']);
   ```

4. **Hybrid Queries**
   ```typescript
   // Find decisions in auth code mentioning "JWT"
   const results = await conn.runAndReadAll(`
     SELECT k.*, fts_main_knowledge.match_bm25(k.id, ?) as score
     FROM knowledge k
     WHERE k.type = 'decision'
       AND k.path LIKE '%/auth/%'
       AND score IS NOT NULL
     ORDER BY score DESC
   `, ['JWT']);
   ```

5. **Aggregations and Analytics**
   ```typescript
   // Get counts of knowledge by type
   const stats = await conn.runAndReadAll(`
     SELECT type, COUNT(*) as count
     FROM knowledge
     GROUP BY type
   `);
   // Result: [ { type: 'rule', count: 45 }, { type: 'decision', count: 12 }, ... ]
   ```

### What We Gain Immediately

With DuckDB from day one, Beacon MCP gets:

✅ **SQL queries** (familiar, powerful, flexible)
✅ **Path hierarchy queries** (core requirement)
✅ **LIKE/glob pattern matching** (core requirement)
✅ **Full-text search** (via FTS extension)
✅ **BM25 scoring** (relevance ranking)
✅ **JSON support** (for references field)
✅ **Aggregations** (GROUP BY type, library, etc.)
✅ **Transactions** (ACID compliance)
✅ **Parameterized queries** (SQL injection prevention)

### Trade-offs

**Slight Complexity:**
- Need to understand SQL (but most developers already do)
- **Mitigation**: Beacon MCP abstracts SQL behind simple TypeScript APIs

**Single-Threaded Writes:**
- DuckDB uses MVCC but writes are serialized
- **Impact**: Minimal for a development tool (writes are infrequent)

**Database File:**
- DuckDB stores data in a single .duckdb file
- **Impact**: Easy to version control, backup, or share

### Long-Term Vision

DuckDB enables future features without storage layer changes:

🔮 **Phase 2+:**
- Cross-reference search ("Show me all decisions referencing this rule")
- Time-based queries ("Show knowledge added in last 30 days")
- Path-based aggregations ("Count rules per directory")
- Complex filtering (JOINS, subqueries, etc.)

🔮 **Advanced:**
- Query optimization (DuckDB's query planner)
- Export to CSV/Parquet/JSON (built-in DuckDB features)
- Analytics dashboard (query result aggregations)

**None of these require changing storage technology** - they're all SQL features we can use immediately.

---

## Core Concepts

### 1. Path-Based Knowledge

Every piece of knowledge has a **path** that defines where it applies in the project tree:

```
. (root)
├── src/
│   ├── server/
│   │   ├── api/
│   │   │   └── users.ts
│   │   └── services/
│   │       └── alerts/
│   │           └── email.ts
│   └── client/
│       └── components/
└── tests/
```

**Example Rules:**

```
Rule 1: path="." content="Use TypeScript strict mode"
Rule 2: path="src/server" content="All handlers must validate input"
Rule 3: path="src/server/services" content="Services must log errors"
Rule 4: path="src/server/services/alerts" content="Alerts must be idempotent"
```

When working on `src/server/services/alerts/email.ts`, all four rules apply (hierarchical inheritance).

### 2. Knowledge Types

**All knowledge types are path-based:**

1. **Rules** - Coding standards, conventions, requirements
   - Example: "All API handlers in `src/server/api` must use Zod for validation"
   - Retrieval: Path/glob/scope hierarchy (instant)
   - Supports exceptions (see Rule Exceptions section)

2. **Decisions** - Architecture decisions, rationale, trade-offs
   - Example: "In `src/server/auth`, we use JWT instead of sessions because..."
   - Retrieval: Path hierarchy (instant)

3. **Documentation** - How YOUR codebase implements patterns and uses libraries
   - Example: "How we wrap TypeBox types in `core/types/`" (not generic TypeBox docs)
   - Example: "Our custom error handling patterns in `src/server/errors`"
   - Retrieval: Path hierarchy (instant)

**Note:** Domain knowledge (business logic, domain models) belongs in `nanorag-mcp` (the RAG server) where semantic search is beneficial.

### 3. Hierarchical Inheritance

Knowledge at a parent path applies to all descendants:

```typescript
// Get rules for src/server/services/alerts/email.ts
const ancestors = [
    ".",                              // Root (global)
    "src",                            // Source directory
    "src/server",                     // Server code
    "src/server/services",            // Service layer
    "src/server/services/alerts",    // Alerts service
    "src/server/services/alerts/email.ts", // Specific file
];

// Query returns rules from ALL ancestors, ordered general → specific
const rules = await getRulesForPath("src/server/services/alerts/email.ts");
// Returns: [Rule1, Rule2, Rule3, Rule4]
```

### 4. Glob Patterns and Granular Scoping

**Glob patterns are REQUIRED from Phase 1** - they're essential for excluding files from rules.

**Supported Path Formats:**

```
# Simple paths (hierarchical)
path: "src/server"          // Applies to src/server and ALL descendants
path: "tests"               // Applies to tests and ALL descendants
path: "."                   // Applies to entire project (global)

# Glob patterns (selective)
path: "%test.ts"            // All test files (SQL LIKE pattern)
path: "src/%/services/"     // Services dirs in any top-level src folder
path: "src/%config.js"      // Config files anywhere in src
path: "!src/%test.ts"       // Exclude test files (negation)

# File-specific
path: "src/server/auth.ts"  // Only this file

# Function-specific (granular scoping)
path: "src/server/auth.ts:login"           // Only the login function
path: "src/server/auth.ts:handleAuth"      // Only the handleAuth function

# Line range-specific
path: "src/server/auth.ts:104"             // Only line 104
path: "src/server/auth.ts:104-150"         // Lines 104 to 150

# Named rule scopes (in comments)
path: "src/server/auth.ts:@no-console"     // Anywhere marked with // @no-console
```

**Implementation:**
- Use SQL `LIKE` for glob pattern matching
- Parse `:` delimiter for granular scoping
- Store scope type (`file`, `function`, `line`, `lineRange`, `named`) separately
- Index by scope type for efficient queries

### 5. References System

Knowledge items can reference each other using special syntax:

```markdown
# Example Rule

Always use our TypeBox wrappers instead of importing Type directly.

See [doc:core/types/usage] for wrapper documentation.

Related: [decision:typebox-wrappers]
```

**Reference Syntax:**

```
[type:path]           // Reference by path
[type:path:title]     // Reference by path and title
[id:123]              // Reference by ID

Types: rule, decision, doc
```

**Features:**
- Validated references (must exist)
- Backlinks (what references this?)
- Dependency tracking
- Dead reference detection

### 6. Rule Exceptions

Rules can be explicitly ignored at specific locations:

**In-code exceptions (comments):**

```typescript
// @beacon-ignore rule:no-console
console.log("Debug info")  // This is allowed

// @beacon-ignore rule:api-validation
// Reason: Internal endpoint, validation happens in middleware
export function internalEndpoint(req: Request) {
  // No Zod validation here
}
```

**Exception records in database:**

```yaml
---
type: exception
rule: api-validation
path: src/server/internal/health.ts
reason: Health check endpoint doesn't need validation
---
```

**Design questions to resolve:**
- Should exceptions be stored as separate records or embedded in rules?
- How to validate exceptions (must reference existing rule)?
- How to report violations vs exceptions?

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                              │
│  (Claude Code, CLI, CI/CD, Other MCP Clients)              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ MCP Protocol (stdio)
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                    MCP Server Layer                         │
│  ┌────────────┐ ┌─────────────┐ ┌──────────────┐          │
│  │store-      │ │search-      │ │update-       │          │
│  │knowledge   │ │knowledge    │ │knowledge     │          │
│  └────────────┘ └─────────────┘ └──────────────┘          │
│  ┌────────────┐ ┌─────────────┐                           │
│  │delete-     │ │get-         │   Simplified: single      │
│  │knowledge   │ │references   │   search tool handles     │
│  └────────────┘ └─────────────┘   all query types         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Internal API
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                  Query Engine Layer                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Path Hierarchy Resolver                              │  │
│  │  - getPathAncestors(filePath) → string[]            │  │
│  │  - matchGlobPattern(pattern, path) → boolean        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Query Builder                                        │  │
│  │  - Build SQL queries from filters                   │  │
│  │  - Handle parameterization                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Storage API
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                  Storage Layer (DuckDB)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ knowledge Table                                      │  │
│  │  - id (VARCHAR PRIMARY KEY)                          │  │
│  │  - type (VARCHAR CHECK)                              │  │
│  │  - path (VARCHAR NOT NULL)                           │  │
│  │  - scope (VARCHAR)                                   │  │
│  │  - scope_value (VARCHAR)                             │  │
│  │  - title (VARCHAR NOT NULL)                          │  │
│  │  - content (VARCHAR NOT NULL)                        │  │
│  │  - library (VARCHAR)                                 │  │
│  │  - references (JSON)                                 │  │
│  │  - created_at (TIMESTAMP)                            │  │
│  │  - updated_at (TIMESTAMP)                            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ FTS Index (via PRAGMA create_fts_index)              │  │
│  │  - Indexes: title, content                           │  │
│  │  - Stemmer: porter                                   │  │
│  │  - Stopwords: english                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**MCP Server Layer:**
- Handles MCP protocol communication
- Validates tool requests
- Routes to appropriate handlers
- Formats responses

**Query Engine Layer:**
- Resolves path hierarchies
- Matches glob patterns
- Builds SQL queries
- Filters and sorts results

**Storage Layer:**
- Persists knowledge records
- Maintains FTS index
- Handles CRUD operations
- Ensures data integrity

### Data Flow Diagrams

#### Storing Knowledge

```
┌──────────┐                                 ┌──────────────┐
│          │  store-knowledge MCP call       │              │
│  Client  ├────────────────────────────────►│  MCP Server  │
│          │  {type, path, content, ...}     │              │
└──────────┘                                 └──────┬───────┘
                                                    │
                                                    │ Validate
                                                    │
                                             ┌──────▼───────┐
                                             │   Validator  │
                                             │  - Type enum │
                                             │  - Path fmt  │
                                             │  - Content   │
                                             └──────┬───────┘
                                                    │
                                                    │ Valid
                                                    │
                                             ┌──────▼───────┐
                                             │   DuckDB     │
                                             │  - INSERT    │
                                             │  - FTS index │
                                             └──────┬───────┘
                                                    │
                                                    │ Success
                                                    │
┌──────────┐                                 ┌──────▼───────┐
│          │  {success: true, id: "uuid"}    │              │
│  Client  │◄────────────────────────────────┤  MCP Server  │
│          │                                 │              │
└──────────┘                                 └──────────────┘
```

#### Retrieving Rules for a Path

```
┌──────────┐                                 ┌──────────────┐
│          │  get-rules-for-path             │              │
│  Client  ├────────────────────────────────►│  MCP Server  │
│          │  {filePath: "src/server/..."}   │              │
└──────────┘                                 └──────┬───────┘
                                                    │
                                                    │
                                             ┌──────▼───────┐
                                             │Path Resolver │
                                             │getAncestors()│
                                             └──────┬───────┘
                                                    │
                                    ['.', 'src', 'src/server', ...]
                                                    │
                                             ┌──────▼───────┐
                                             │Query Builder │
                                             │ Build SQL    │
                                             │ WHERE path IN│
                                             └──────┬───────┘
                                                    │
                                                    │ SQL Query
                                                    │
                                             ┌──────▼───────┐
                                             │   DuckDB     │
                                             │  SELECT ...  │
                                             └──────┬───────┘
                                                    │
                                              [Rule1, Rule2, ...]
                                                    │
                                             ┌──────▼───────┐
                                             │   Formatter  │
                                             │  toMCPResult │
                                             └──────┬───────┘
                                                    │
┌──────────┐                                 ┌──────▼───────┐
│          │  {rules: [...]}                 │              │
│  Client  │◄────────────────────────────────┤  MCP Server  │
│          │                                 │              │
└──────────┘                                 └──────────────┘
```

---

## Knowledge Types

### 1. Rules

**Purpose:** Define coding standards, conventions, and requirements that must be followed.

**Characteristics:**
- ✅ Always have a specific path
- ✅ Inherit from parent paths
- ✅ Retrieved deterministically (same file → same rules)
- ❌ Never need semantic search
- ❌ Never need embeddings

**Examples:**

```markdown
---
title: TypeScript Strict Mode
type: rule
path: .
---

All TypeScript files must use strict mode. Add this to tsconfig.json:

\`\`\`json
{
  "compilerOptions": {
    "strict": true
  }
}
\`\`\`
```

```markdown
---
title: API Input Validation
type: rule
path: src/server/api
---

All API handlers must validate input using Zod schemas.

Example:

\`\`\`typescript
import { z } from 'zod'

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
})

export async function createUser(req: Request) {
  const data = userSchema.parse(req.body)
  // ... safe to use data
}
\`\`\`
```

**Storage:**

```typescript
interface Knowledge {
  id: string;              // UUID
  type: 'rule';
  path: string;            // 'src/server/api'
  scope?: ScopeType;
  scopeValue?: string;
  title: string;           // 'API Input Validation'
  content: string;         // Full markdown content
  library?: string;
  references?: Reference[];
  createdAt: Date;
  updatedAt: Date;
}
```

**Query:**

```typescript
async function getRulesForPath(
  conn: DuckDBConnection,
  filePath: string
): Promise<Knowledge[]> {
  const ancestors = getPathAncestors(filePath);

  const placeholders = ancestors.map(() => '?').join(',');
  const reader = await conn.runAndReadAll(`
    SELECT * FROM knowledge
    WHERE type = 'rule'
      AND path IN (${placeholders})
    ORDER BY length(path)
  `, ancestors);

  return reader.getRowObjects() as Knowledge[];
}
```

### 2. Decisions

**Purpose:** Document architecture decisions, rationale for technical choices, and trade-offs made.

**Characteristics:**
- ✅ Always have a specific path (where the decision applies)
- ✅ Include context: what was decided, why, and what was rejected
- ✅ Inherit from parent paths (architectural decisions cascade down)
- 🟡 May occasionally benefit from cross-cutting search ("all decisions about X")

**Examples:**

```markdown
---
title: JWT vs Sessions
type: decision
path: src/server/auth
---

## Decision

Use JWT tokens for authentication instead of server-side sessions.

## Context

We need to support mobile clients and potentially scale horizontally.

## Rationale

- ✅ Stateless: No server-side session storage needed
- ✅ Mobile-friendly: Works well with native apps
- ✅ Scalability: No session affinity required
- ✅ Microservices: Can be validated by any service

## Rejected Alternatives

- **Server-side sessions**: Requires sticky sessions or shared session store
- **OAuth only**: Too complex for our internal API

## Consequences

- Must implement token refresh strategy
- Need to handle token revocation (blacklist)
- Tokens contain user claims (larger than session IDs)

## References

- RFC 7519 (JWT spec)
- OWASP JWT Cheat Sheet
```

**Storage:** Same `Knowledge` interface as rules, just `type: 'decision'`

**Query:**

```typescript
async function getDecisionsForPath(
  conn: DuckDBConnection,
  filePath: string
): Promise<Knowledge[]> {
  const ancestors = getPathAncestors(filePath);

  const placeholders = ancestors.map(() => '?').join(',');
  const reader = await conn.runAndReadAll(`
    SELECT * FROM knowledge
    WHERE type = 'decision'
      AND path IN (${placeholders})
    ORDER BY length(path)
  `, ancestors);

  return reader.getRowObjects() as Knowledge[];
}
```

### 3. Documentation

**Purpose:** Library-specific usage guides, patterns, and gotchas for the project.

**Characteristics:**
- ✅ Always have a path (where the library is used)
- ✅ Always have a library name (react, postgres, express, etc.)
- ✅ Filter by both path AND library
- 🟡 May benefit from keyword search within filtered results

**Examples:**

```markdown
---
title: React Hooks Patterns
type: doc
path: src/client
library: react
---

## useEffect Dependencies

Always include all values from component scope that change over time and are used by effect:

\`\`\`typescript
function UserProfile({ userId }: Props) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchUser(userId).then(setUser)
  }, [userId]) // ✅ userId is a dependency
}
\`\`\`

## Custom Hooks

Extract complex logic into custom hooks:

\`\`\`typescript
function useUser(userId: string) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchUser(userId)
      .then(setUser)
      .finally(() => setLoading(false))
  }, [userId])

  return { user, loading }
}
\`\`\`
```

**Storage:**

```typescript
interface Knowledge {
  id: string;
  type: 'doc';
  path: string;            // 'src/client'
  library: string;         // 'react'
  title: string;           // 'React Hooks Patterns'
  content: string;         // Full markdown content
  // ... other fields
}
```

**Query:**

```typescript
async function getDocsForPath(
  conn: DuckDBConnection,
  filePath: string,
  libraries: string[]
): Promise<Knowledge[]> {
  const ancestors = getPathAncestors(filePath);

  const pathPlaceholders = ancestors.map(() => '?').join(',');
  const libPlaceholders = libraries.map(() => '?').join(',');

  const reader = await conn.runAndReadAll(`
    SELECT * FROM knowledge
    WHERE type = 'doc'
      AND library IN (${libPlaceholders})
      AND path IN (${pathPlaceholders})
  `, [...libraries, ...ancestors]);

  return reader.getRowObjects() as Knowledge[];
}
```

---

## Data Models

### Core Types

```typescript
// src/core/models/types.ts

export enum KnowledgeType {
  Rule = 'rule',
  Decision = 'decision',
  Doc = 'doc',
}

export enum ScopeType {
  File = 'file',           // Entire file or path
  Function = 'function',   // Specific function
  Line = 'line',           // Single line
  LineRange = 'lineRange', // Range of lines
  Named = 'named',         // Named scope in comments (@rule-name)
}

export interface Reference {
  type: KnowledgeType;
  path: string;
  title?: string;
}

export interface Knowledge {
  id: string;              // UUID
  type: KnowledgeType;
  path: string;            // Path or glob pattern
  scope?: ScopeType;       // Granularity
  scopeValue?: string;     // Function name, line numbers, etc.
  title: string;           // Human-readable title
  content: string;         // Full markdown content
  library?: string;        // For doc type
  references?: Reference[]; // Links to other knowledge items
  createdAt: Date;
  updatedAt: Date;
}

export class KnowledgeValidator {
  static validate(k: Partial<Knowledge>): void {
    if (!k.type) {
      throw new Error('type is required');
    }

    if (!Object.values(KnowledgeType).includes(k.type)) {
      throw new Error(`invalid type: ${k.type}`);
    }

    if (!k.path) {
      throw new Error('path is required');
    }

    if (!k.content) {
      throw new Error('content is required');
    }

    // Validate scope if specified
    if (k.scope) {
      if (!Object.values(ScopeType).includes(k.scope)) {
        throw new Error(`invalid scope: ${k.scope}`);
      }

      // Scope requires scopeValue except for file scope
      if (k.scope !== ScopeType.File && !k.scopeValue) {
        throw new Error(`scope ${k.scope} requires scopeValue`);
      }
    }

    // Type-specific validation
    if (k.type === KnowledgeType.Doc && !k.library) {
      throw new Error('library is required for doc type');
    }
  }
}
```

### Request/Response Models

```typescript
// src/core/models/requests.ts

export interface StoreKnowledgeRequest {
  type: KnowledgeType;
  path: string;            // Can be path or glob pattern
  scope?: ScopeType;       // Optional granular scope
  scopeValue?: string;     // Value for scope (function name, lines, etc.)
  title: string;
  content: string;
  library?: string;        // Required if type=doc
  references?: Reference[]; // Links to other knowledge
}

export interface SearchKnowledgeRequest {
  type?: KnowledgeType;    // Filter by type
  path?: string;           // File path or glob pattern to search
  scope?: ScopeType;       // Filter by scope granularity
  library?: string;        // Filter by library (for docs)
  contentQuery?: string;   // Full-text search query
  includeAncestors?: boolean; // Include parent path knowledge (default: true)
  limit?: number;          // Max results
}

export interface KnowledgeResponse {
  id: string;
  type: KnowledgeType;
  path: string;
  scope?: ScopeType;
  scopeValue?: string;
  title: string;
  content: string;
  library?: string;
  references?: Reference[];
  backlinks?: Reference[];  // What references this?
  score?: number;           // Relevance score for FTS queries
  createdAt: Date;
  updatedAt: Date;
}

export function toResponse(k: Knowledge, backlinks?: Reference[], score?: number): KnowledgeResponse {
  return {
    id: k.id,
    type: k.type,
    path: k.path,
    scope: k.scope,
    scopeValue: k.scopeValue,
    title: k.title,
    content: k.content,
    library: k.library,
    references: k.references,
    backlinks,
    score,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  };
}
```

### Frontmatter Schema

When storing knowledge as markdown files, use YAML frontmatter:

**Simple Rule (applies to entire path):**
```yaml
---
title: "API Input Validation"
type: rule
path: src/server/api
---

# Rule Content

All API handlers must validate input using Zod schemas.

See [doc:src/server/validation-patterns] for examples.
```

**Granular Rule (function-specific):**
```yaml
---
title: "No Console Logging in Production"
type: rule
path: src/server/**/*.ts
scope: function
scopeValue: handleRequest
---

Never use console.log in the handleRequest function. Use our logger instead.
```

**Documentation (codebase patterns):**
```yaml
---
title: "TypeBox Wrappers"
type: doc
path: core/types
library: typebox
references:
  - type: rule
    path: core/types
    title: "Always use wrappers"
---

# Our TypeBox Usage Patterns

We wrap TypeBox exports for simpler syntax:

\`\`\`typescript
import { object, string, num } from '@/core/types'
// Instead of: import { Type } from 'typebox'
\`\`\`

Related: [rule:core/types:use-wrappers]
```

---

## Application Architecture with Avvio

### Why Avvio?

Beacon MCP uses **Avvio** for application lifecycle management and plugin-based architecture. This pattern (proven in production at scale by Fastify) provides:

1. **Dependency Injection**: Plugins declare dependencies explicitly
2. **Lifecycle Management**: Clean startup/shutdown with hooks
3. **Progressive Composition**: Type-safe context building
4. **Error Handling**: Proper error propagation and cleanup
5. **Testability**: Easy to mock and test individual plugins

### Application Bootstrap Pattern

```typescript
// src/app.ts

import avvio from 'avvio';
import type { ApplicationContext } from './types/app-context.js';
import type { CliConfig } from './types/cli.js';

// Plugin imports in dependency order
import { configPlugin } from './plugins/config.js';
import { loggerPlugin } from './plugins/logger.js';
import { databasePlugin } from './plugins/database.js';
import { queryEnginePlugin } from './plugins/query-engine.js';
import { mcpServerPlugin } from './plugins/server.js';

/**
 * Create application instance with Avvio
 */
export function createApp(options: { timeout?: number } = {}): avvio.Avvio<ApplicationContext> {
  const { timeout = 30000 } = options;

  // Create base application context
  const baseApp: ApplicationContext = {
    name: 'beacon-mcp',
    version: '1.0.0',
    isReady: false,
  };

  // Initialize Avvio
  const app = avvio(baseApp, {
    autostart: false,
    timeout,
    expose: {
      use: 'use',
    },
  });

  // Lifecycle event handlers
  app.on('start', () => {
    console.error('[app] Application starting...');
  });

  app.on('preReady', () => {
    console.error('[app] Application pre-ready phase');
  });

  app.ready((err: Error | undefined) => {
    if (err) {
      console.error('[app] Failed to start application:', err);
      return;
    }
    const appContext = app as unknown as ApplicationContext;
    appContext.isReady = true;
    console.error('[app] Application ready');
  });

  return app;
}

/**
 * Start the application with all plugins loaded in dependency order
 */
export async function startApp(
  cliConfig: CliConfig = {},
  options: { timeout?: number } = {}
): Promise<ApplicationContext> {
  const app = createApp(options);

  try {
    // Register plugins in strict dependency order
    // Plugins execute when app.ready() is called

    // 1. Configuration Plugin
    // Uses: none
    // Provides: app.config
    app.use(configPlugin, cliConfig);

    // 2. Logger Plugin
    // Uses: app.config
    // Provides: app.logger
    app.use(loggerPlugin);

    // 3. Database Plugin
    // Uses: app.config, app.logger
    // Provides: app.database
    app.use(databasePlugin);

    // 4. Query Engine Plugin
    // Uses: app.database, app.logger
    // Provides: app.queryEngine
    app.use(queryEnginePlugin);

    // 5. MCP Server Plugin (final plugin, uses all services)
    // Uses: app.database, app.queryEngine, app.logger
    // Provides: app.server
    app.use(mcpServerPlugin);

    // Execute all registered plugins
    await app.ready();

    // Return fully initialized application
    return app as unknown as ApplicationContext;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[app] Failed to start application:', errorMessage);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
}
```

### Plugin Pattern

Each plugin follows this pattern:

```typescript
// src/plugins/database.ts

import type { ApplicationContext, AppPlugin } from '../types/app-context.js';
import { PluginDependencyError, PluginInitError } from '../types/errors.js';
import { createDatabase } from '../storage/database.js';

/**
 * Database plugin that creates a database instance and adds it to app context
 */
export const databasePlugin: AppPlugin = async function(
  app: ApplicationContext
): Promise<void> {
  try {
    // Verify dependencies are available
    if (!app.config) {
      throw new PluginDependencyError('Database', 'Configuration');
    }

    if (!app.logger) {
      throw new PluginDependencyError('Database', 'Logger');
    }

    const { config, logger } = app;

    // Create database using factory function
    const database = createDatabase({
      location: config.databasePath,
      logger,
      environment: config.environment || 'development',
    });

    // Add to application context
    app.database = database;

    logger.info('Database plugin initialized successfully', {
      databasePath: config.databasePath,
      project: config.projectName,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (app.logger) {
      app.logger.error('Failed to initialize database', error);
    } else {
      console.error('[database] Failed to initialize database:', errorMessage);
    }

    throw new PluginInitError('Database', errorMessage, error);
  }
};
```

### Application Context Type

```typescript
// src/types/app-context.ts

import type { ResolvedConfig } from './config.js';
import type { Database } from './database.js';
import type { Logger } from './logger.js';
import type { QueryEngine } from './query-engine.js';
import type { Knowledge } from './models.js';

/**
 * Application context interface for plugins
 * Each plugin progressively extends this context
 */
export type ApplicationContext = {
  name: string;
  version: string;
  isReady: boolean;
  config?: ResolvedConfig;
  logger?: Logger;
  database?: Database;
  queryEngine?: QueryEngine;
  server?: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
  };
};

/**
 * Plugin function type for Avvio
 */
export type AppPlugin<T = void> = (
  app: ApplicationContext,
  options?: T
) => Promise<void> | void;
```

### Custom Error Types

```typescript
// src/types/errors.ts

/**
 * Base error class for Beacon MCP errors
 */
export class BeaconError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Plugin initialization error
 */
export class PluginInitError extends BeaconError {
  constructor(
    public readonly pluginName: string,
    message: string,
    cause?: unknown
  ) {
    super(`Failed to initialize ${pluginName} plugin: ${message}`, 'PLUGIN_INIT_ERROR', cause);
  }
}

/**
 * Plugin dependency error
 */
export class PluginDependencyError extends BeaconError {
  constructor(
    public readonly pluginName: string,
    public readonly dependencyName: string
  ) {
    super(
      `${pluginName} plugin requires ${dependencyName} but it is not available`,
      'PLUGIN_DEPENDENCY_ERROR'
    );
  }
}

/**
 * Configuration error
 */
export class ConfigError extends BeaconError {
  constructor(message: string, cause?: unknown) {
    super(`Configuration error: ${message}`, 'CONFIG_ERROR', cause);
  }
}

/**
 * Validation error
 */
export class ValidationError extends BeaconError {
  constructor(message: string, public readonly field?: string, cause?: unknown) {
    super(`Validation error: ${message}`, 'VALIDATION_ERROR', cause);
  }
}

/**
 * Database error
 */
export class DatabaseError extends BeaconError {
  constructor(message: string, cause?: unknown) {
    super(`Database error: ${message}`, 'DATABASE_ERROR', cause);
  }
}

/**
 * Query error
 */
export class QueryError extends BeaconError {
  constructor(message: string, public readonly query?: string, cause?: unknown) {
    super(`Query error: ${message}`, 'QUERY_ERROR', cause);
  }
}
```

---

## Project Structure

```
beacon-mcp/
├── src/
│   ├── app.ts                   # Avvio setup + plugin registration
│   ├── cli/                     # CLI tool (Stricli-based)
│   │   ├── index.ts             # Stricli CLI entry point
│   │   ├── logger.ts            # CLI-specific logger
│   │   └── commands/
│   │       ├── serve.ts         # Start MCP server
│   │       ├── store.ts         # Store knowledge
│   │       ├── search.ts        # Search knowledge
│   │       └── list.ts          # List knowledge
│   ├── config/
│   │   └── loader.ts            # Configuration loading
│   ├── plugins/                 # Plugin registration functions
│   │   ├── config.ts            # Configuration plugin
│   │   ├── logger.ts            # Logger plugin
│   │   ├── database.ts          # Database plugin
│   │   ├── query-engine.ts      # Query engine plugin
│   │   └── server.ts            # MCP server plugin
│   ├── storage/                 # DuckDB implementation
│   │   ├── database.ts          # Database factory + implementation
│   │   ├── migrations.ts        # Schema setup
│   │   └── __tests__/
│   │       └── database.test.ts
│   ├── query/                   # Query engine implementation
│   │   ├── PathResolver.ts      # Path hierarchy resolution
│   │   ├── QueryBuilder.ts      # SQL query construction
│   │   ├── GlobMatcher.ts       # Glob pattern matching
│   │   └── __tests__/
│   ├── types/                   # All type definitions
│   │   ├── app-context.ts       # Application context types
│   │   ├── config.ts            # Configuration types
│   │   ├── database.ts          # Database interface types
│   │   ├── errors.ts            # Custom error classes
│   │   ├── logger.ts            # Logger types
│   │   ├── models.ts            # Knowledge, KnowledgeType, etc.
│   │   ├── mcp-tools.ts         # MCP tool schemas
│   │   └── query-engine.ts      # Query engine types
│   ├── parser/                  # Markdown parsing
│   │   ├── frontmatter.ts       # YAML frontmatter extraction
│   │   └── markdown.ts          # Markdown processing
│   └── utils.ts                 # Utility functions
├── tests/
│   ├── integration/
│   └── e2e/
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Package Responsibilities

**`src/app.ts`**
- Avvio application bootstrap
- Plugin registration in dependency order
- Lifecycle management
- Application startup/shutdown

**`src/plugins/`**
- Plugin registration functions
- Dependency checking
- Service initialization
- Context extension

**`src/storage/`**
- DuckDB connection management
- Database factory function
- Schema migrations
- CRUD operations

**`src/query/`**
- Path hierarchy resolution
- SQL query building
- Glob pattern matching
- Result filtering

**`src/types/`**
- All TypeScript type definitions
- Application context types
- Plugin types
- Error types

**`src/cli/`**
- Stricli command definitions
- CLI entry point
- Command modules
- Output formatting

**`src/config/`**
- Configuration loading
- Environment detection
- Path resolution

**`src/parser/`**
- YAML frontmatter extraction
- Markdown parsing
- Content validation

---

## Storage Layer

### Database Factory Pattern

The storage layer uses a factory function pattern that returns a Database interface. This provides:
- Clean separation between interface and implementation
- Easy mocking for tests
- Consistent Promise-based API
- Transaction support

```typescript
// src/types/database.ts

import type { Knowledge } from './models.js';
import type { SearchOptions, SearchResult } from './search.js';

/**
 * Database interface
 */
export interface Database {
  storeKnowledge: (knowledge: Omit<Knowledge, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Knowledge>;
  getKnowledge: (id: string) => Promise<Knowledge | null>;
  updateKnowledge: (id: string, updates: Partial<Knowledge>) => Promise<Knowledge>;
  deleteKnowledge: (id: string) => Promise<void>;
  searchByPath: (path: string, type?: KnowledgeType) => Promise<Knowledge[]>;
  searchByContent: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;
  listKnowledge: (type?: KnowledgeType) => Promise<Knowledge[]>;
  dispose: () => Promise<void>;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  location: string;
  logger: Logger;
  environment?: 'development' | 'testing' | 'production';
}
```

### Database Implementation

```typescript
// src/storage/database.ts

import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import { randomUUID } from 'crypto';
import type { Database, DatabaseConfig } from '../types/database.js';
import type { Knowledge, KnowledgeType } from '../types/models.js';
import type { Logger } from '../types/logger.js';
import { DatabaseError, ValidationError } from '../types/errors.js';
import { initializeSchema } from './migrations.js';
import { getPathAncestors } from '../query/PathResolver.js';

/**
 * Create database instance with DuckDB
 */
export function createDatabase(config: DatabaseConfig): Database {
  const { location, logger, environment = 'development' } = config;

  logger.info('Initializing database', { location, environment });

  // Initialize DuckDB instance and connection
  let instance: DuckDBInstance;
  let conn: DuckDBConnection;

  try {
    // Create database (async in Node, but we handle via Promise pattern)
    DuckDBInstance.create(location).then(async (inst) => {
      instance = inst;
      conn = await instance.connect();

      // Initialize schema
      await initializeSchema(conn, logger);

      logger.info('Database initialized successfully');
    });
  } catch (error) {
    logger.error('Failed to initialize database', error);
    throw new DatabaseError('Database initialization failed', error);
  }

  // Return database interface with Promise-wrapped methods
  const database: Database = {
    storeKnowledge: async (knowledge): Promise<Knowledge> => {
      return storeKnowledgeImpl(conn, logger, knowledge);
    },

    getKnowledge: async (id): Promise<Knowledge | null> => {
      return getKnowledgeImpl(conn, logger, id);
    },

    updateKnowledge: async (id, updates): Promise<Knowledge> => {
      return updateKnowledgeImpl(conn, logger, id, updates);
    },

    deleteKnowledge: async (id): Promise<void> => {
      return deleteKnowledgeImpl(conn, logger, id);
    },

    searchByPath: async (path, type): Promise<Knowledge[]> => {
      return searchByPathImpl(conn, logger, path, type);
    },

    searchByContent: async (query, options): Promise<SearchResult[]> => {
      return searchByContentImpl(conn, logger, query, options);
    },

    listKnowledge: async (type): Promise<Knowledge[]> => {
      return listKnowledgeImpl(conn, logger, type);
    },

    dispose: async (): Promise<void> => {
      logger.info('Closing database connection');
      conn.disconnectSync();
      instance.closeSync();
    },
  };

  return database;
}

/**
 * Store knowledge implementation with transactions
 */
async function storeKnowledgeImpl(
  conn: DuckDBConnection,
  logger: Logger,
  knowledge: Omit<Knowledge, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Knowledge> {
  logger.debug('Storing knowledge', { type: knowledge.type, path: knowledge.path });

  const id = randomUUID();
  const now = new Date();

  try {
    // Begin transaction
    await conn.run('BEGIN TRANSACTION');

    // Insert knowledge record
    await conn.run(
      `
      INSERT INTO knowledge (
        id, type, path, scope, scope_value, title, content, library, references, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        knowledge.type,
        knowledge.path,
        knowledge.scope || null,
        knowledge.scopeValue || null,
        knowledge.title,
        knowledge.content,
        knowledge.library || null,
        knowledge.references ? JSON.stringify(knowledge.references) : null,
        now,
        now,
      ]
    );

    // Commit transaction
    await conn.run('COMMIT');

    logger.info('Knowledge stored successfully', { id, type: knowledge.type });

    // Return the stored knowledge
    return {
      id,
      ...knowledge,
      createdAt: now,
      updatedAt: now,
    } as Knowledge;
  } catch (error) {
    // Rollback on error
    await conn.run('ROLLBACK');
    logger.error('Failed to store knowledge, transaction rolled back', error);
    throw new DatabaseError('Failed to store knowledge', error);
  }
}

/**
 * Search by path hierarchy
 */
async function searchByPathImpl(
  conn: DuckDBConnection,
  logger: Logger,
  filePath: string,
  type?: KnowledgeType
): Promise<Knowledge[]> {
  logger.debug('Searching by path', { filePath, type });

  const ancestors = getPathAncestors(filePath);
  const placeholders = ancestors.map(() => '?').join(',');

  const query = type
    ? `SELECT * FROM knowledge WHERE type = ? AND path IN (${placeholders}) ORDER BY length(path)`
    : `SELECT * FROM knowledge WHERE path IN (${placeholders}) ORDER BY length(path)`;

  const params = type ? [type, ...ancestors] : ancestors;

  try {
    const reader = await conn.runAndReadAll(query, params);
    const rows = reader.getRowObjects();

    logger.info('Path search completed', { resultCount: rows.length });

    return rows.map(rowToKnowledge);
  } catch (error) {
    logger.error('Path search failed', error);
    throw new DatabaseError('Path search failed', error);
  }
}

/**
 * Convert database row to Knowledge object
 */
function rowToKnowledge(row: any): Knowledge {
  return {
    id: row.id,
    type: row.type as KnowledgeType,
    path: row.path,
    scope: row.scope || undefined,
    scopeValue: row.scope_value || undefined,
    title: row.title,
    content: row.content,
    library: row.library || undefined,
    references: row.references ? JSON.parse(row.references) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
```

### DuckDB Schema Migrations

```typescript
// src/storage/migrations.ts

import type { DuckDBConnection } from '@duckdb/node-api';
import type { Logger } from '../types/logger.js';

/**
 * Initialize database schema with tables and indexes
 */
export async function initializeSchema(conn: DuckDBConnection, logger: Logger): Promise<void> {
  logger.debug('Initializing database schema');

  // Create knowledge table
  await conn.run(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id VARCHAR PRIMARY KEY,
      type VARCHAR CHECK (type IN ('rule', 'decision', 'doc')),
      path VARCHAR NOT NULL,
      scope VARCHAR CHECK (scope IS NULL OR scope IN ('file', 'function', 'line', 'lineRange', 'named')),
      scope_value VARCHAR,
      title VARCHAR NOT NULL,
      content VARCHAR NOT NULL,
      library VARCHAR,
      references JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for common queries
  await conn.run(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type)
  `);

  await conn.run(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_path ON knowledge(path)
  `);

  await conn.run(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_library ON knowledge(library)
  `);

  // Create full-text search index
  await conn.run(`
    PRAGMA create_fts_index(
      'knowledge',
      'id',
      'title',
      'content',
      stemmer = 'porter',
      stopwords = 'english',
      strip_accents = 1,
      lower = 1,
      overwrite = 0
    )
  `);
}
```

### Repository Implementation

```typescript
// src/storage/DuckDBRepository.ts

import { DuckDBConnection } from '@duckdb/node-api';
import { randomUUID } from 'crypto';
import { Knowledge, KnowledgeType, Reference } from '../core/models/types';
import { KnowledgeValidator } from '../core/validation/validator';
import { getPathAncestors } from '../query/PathResolver';

export class DuckDBRepository {
  constructor(private conn: DuckDBConnection) {}

  async insert(knowledge: Omit<Knowledge, 'id' | 'createdAt' | 'updatedAt'>): Promise<Knowledge> {
    // Validate
    KnowledgeValidator.validate(knowledge);

    const id = randomUUID();
    const now = new Date();

    await this.conn.run(`
      INSERT INTO knowledge (
        id, type, path, scope, scope_value, title, content, library, references, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      knowledge.type,
      knowledge.path,
      knowledge.scope || null,
      knowledge.scopeValue || null,
      knowledge.title,
      knowledge.content,
      knowledge.library || null,
      knowledge.references ? JSON.stringify(knowledge.references) : null,
      now,
      now,
    ]);

    return this.getById(id) as Promise<Knowledge>;
  }

  async getById(id: string): Promise<Knowledge | null> {
    const reader = await this.conn.runAndReadAll(
      `SELECT * FROM knowledge WHERE id = ?`,
      [id]
    );

    const rows = reader.getRowObjects();
    if (rows.length === 0) return null;

    return this.rowToKnowledge(rows[0]);
  }

  async update(id: string, updates: Partial<Knowledge>): Promise<Knowledge> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Knowledge not found: ${id}`);
    }

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    KnowledgeValidator.validate(updated);

    await this.conn.run(`
      UPDATE knowledge
      SET type = ?, path = ?, scope = ?, scope_value = ?, title = ?, content = ?, library = ?, references = ?, updated_at = ?
      WHERE id = ?
    `, [
      updated.type,
      updated.path,
      updated.scope || null,
      updated.scopeValue || null,
      updated.title,
      updated.content,
      updated.library || null,
      updated.references ? JSON.stringify(updated.references) : null,
      updated.updatedAt,
      id,
    ]);

    return this.getById(id) as Promise<Knowledge>;
  }

  async delete(id: string): Promise<void> {
    await this.conn.run(`DELETE FROM knowledge WHERE id = ?`, [id]);
  }

  async list(type?: KnowledgeType): Promise<Knowledge[]> {
    const query = type
      ? `SELECT * FROM knowledge WHERE type = ? ORDER BY created_at DESC`
      : `SELECT * FROM knowledge ORDER BY created_at DESC`;

    const params = type ? [type] : [];
    const reader = await this.conn.runAndReadAll(query, params);

    return reader.getRowObjects().map(row => this.rowToKnowledge(row));
  }

  async searchByPath(filePath: string, type?: KnowledgeType): Promise<Knowledge[]> {
    const ancestors = getPathAncestors(filePath);
    const placeholders = ancestors.map(() => '?').join(',');

    const query = type
      ? `SELECT * FROM knowledge WHERE type = ? AND path IN (${placeholders}) ORDER BY length(path)`
      : `SELECT * FROM knowledge WHERE path IN (${placeholders}) ORDER BY length(path)`;

    const params = type ? [type, ...ancestors] : ancestors;
    const reader = await this.conn.runAndReadAll(query, params);

    return reader.getRowObjects().map(row => this.rowToKnowledge(row));
  }

  async fullTextSearch(
    query: string,
    options?: {
      type?: KnowledgeType;
      pathPrefix?: string;
      library?: string;
    }
  ): Promise<Array<Knowledge & { score: number }>> {
    let sql = `
      SELECT k.*, fts_main_knowledge.match_bm25(k.id, ?) as score
      FROM knowledge k
      WHERE score IS NOT NULL
    `;

    const params: any[] = [query];

    if (options?.type) {
      sql += ` AND k.type = ?`;
      params.push(options.type);
    }

    if (options?.pathPrefix) {
      sql += ` AND k.path LIKE ?`;
      params.push(`${options.pathPrefix}%`);
    }

    if (options?.library) {
      sql += ` AND k.library = ?`;
      params.push(options.library);
    }

    sql += ` ORDER BY score DESC`;

    const reader = await this.conn.runAndReadAll(sql, params);

    return reader.getRowObjects().map(row => ({
      ...this.rowToKnowledge(row),
      score: row.score as number,
    }));
  }

  async getRulesForPath(filePath: string): Promise<Knowledge[]> {
    return this.searchByPath(filePath, KnowledgeType.Rule);
  }

  async getDecisionsForPath(filePath: string): Promise<Knowledge[]> {
    return this.searchByPath(filePath, KnowledgeType.Decision);
  }

  async getDocsForPath(filePath: string, libraries: string[]): Promise<Knowledge[]> {
    const ancestors = getPathAncestors(filePath);
    const pathPlaceholders = ancestors.map(() => '?').join(',');
    const libPlaceholders = libraries.map(() => '?').join(',');

    const reader = await this.conn.runAndReadAll(`
      SELECT * FROM knowledge
      WHERE type = 'doc'
        AND library IN (${libPlaceholders})
        AND path IN (${pathPlaceholders})
    `, [...libraries, ...ancestors]);

    return reader.getRowObjects().map(row => this.rowToKnowledge(row));
  }

  async getAllForPath(filePath: string, libraries?: string[]): Promise<Knowledge[]> {
    const ancestors = getPathAncestors(filePath);
    const pathPlaceholders = ancestors.map(() => '?').join(',');

    let sql = `
      SELECT * FROM knowledge
      WHERE path IN (${pathPlaceholders})
        AND (type IN ('rule', 'decision')
    `;

    const params: any[] = [...ancestors];

    if (libraries && libraries.length > 0) {
      const libPlaceholders = libraries.map(() => '?').join(',');
      sql += ` OR (type = 'doc' AND library IN (${libPlaceholders}))`;
      params.push(...libraries);
    }

    sql += `) ORDER BY type, length(path)`;

    const reader = await this.conn.runAndReadAll(sql, params);

    return reader.getRowObjects().map(row => this.rowToKnowledge(row));
  }

  private rowToKnowledge(row: any): Knowledge {
    return {
      id: row.id,
      type: row.type as KnowledgeType,
      path: row.path,
      scope: row.scope || undefined,
      scopeValue: row.scope_value || undefined,
      title: row.title,
      content: row.content,
      library: row.library || undefined,
      references: row.references ? JSON.parse(row.references) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
```

---

## Query Engine

### Path Hierarchy Resolution

```typescript
// src/query/PathResolver.ts

import path from 'path';

/**
 * Get all ancestor paths for a given file path
 *
 * Example:
 *   getPathAncestors('src/server/services/alerts/email.ts')
 *   Returns: ['.', 'src', 'src/server', 'src/server/services', 'src/server/services/alerts', 'src/server/services/alerts/email.ts']
 */
export function getPathAncestors(filePath: string): string[] {
  // Normalize path separators to forward slashes
  const normalized = filePath.replace(/\\/g, '/');

  // Handle root case
  if (normalized === '.' || normalized === '') {
    return ['.'];
  }

  // Clean the path
  const cleaned = path.posix.normalize(normalized);

  const parts = cleaned.split('/').filter(p => p && p !== '.');
  const ancestors: string[] = ['.'];  // Always include root

  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    ancestors.push(current);
  }

  return ancestors;
}

/**
 * Check if a file path matches a glob pattern
 *
 * Supports:
 * - Exact matches: 'src/server/api.ts'
 * - Wildcards: 'src/*.ts', 'src/%/api.ts'
 * - Suffix matches: '%test.ts'
 * - Prefix matches: 'src/server%'
 */
export function matchesGlobPattern(pattern: string, filePath: string): boolean {
  // Convert glob pattern to SQL LIKE pattern
  // In SQL LIKE: % matches any characters, _ matches single character
  // We'll use % for wildcards

  // Escape special SQL LIKE characters in pattern
  const sqlPattern = pattern
    .replace(/[%_]/g, '\\$&')  // Escape existing % and _
    .replace(/\*/g, '%')       // Convert * to %
    .replace(/\?/g, '_');      // Convert ? to _

  // Simple regex-based matching for now
  const regexPattern = sqlPattern
    .replace(/%/g, '.*')
    .replace(/_/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}
```

### Query Builder

```typescript
// src/query/QueryBuilder.ts

import { KnowledgeType, ScopeType } from '../core/models/types';
import { getPathAncestors } from './PathResolver';

export interface QueryFilter {
  type?: KnowledgeType;
  path?: string;
  scope?: ScopeType;
  library?: string;
  contentQuery?: string;
  includeAncestors?: boolean;
}

export class QueryBuilder {
  private sql: string = '';
  private params: any[] = [];

  constructor(private baseTable: string = 'knowledge') {}

  filter(filter: QueryFilter): this {
    const conditions: string[] = [];

    // Type filter
    if (filter.type) {
      conditions.push(`${this.baseTable}.type = ?`);
      this.params.push(filter.type);
    }

    // Path filter with ancestor support
    if (filter.path) {
      if (filter.includeAncestors !== false) {
        // Include all ancestor paths
        const ancestors = getPathAncestors(filter.path);
        const placeholders = ancestors.map(() => '?').join(',');
        conditions.push(`${this.baseTable}.path IN (${placeholders})`);
        this.params.push(...ancestors);
      } else {
        // Exact path match
        conditions.push(`${this.baseTable}.path = ?`);
        this.params.push(filter.path);
      }
    }

    // Scope filter
    if (filter.scope) {
      conditions.push(`${this.baseTable}.scope = ?`);
      this.params.push(filter.scope);
    }

    // Library filter
    if (filter.library) {
      conditions.push(`${this.baseTable}.library = ?`);
      this.params.push(filter.library);
    }

    // Full-text search
    if (filter.contentQuery) {
      conditions.push(`fts_main_knowledge.match_bm25(${this.baseTable}.id, ?) IS NOT NULL`);
      this.params.push(filter.contentQuery);
    }

    if (conditions.length > 0) {
      this.sql = conditions.join(' AND ');
    }

    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    if (this.sql) {
      this.sql += ` ORDER BY ${field} ${direction}`;
    }
    return this;
  }

  limit(count: number): this {
    if (this.sql) {
      this.sql += ` LIMIT ${count}`;
    }
    return this;
  }

  build(): { sql: string; params: any[] } {
    const query = this.sql
      ? `SELECT * FROM ${this.baseTable} WHERE ${this.sql}`
      : `SELECT * FROM ${this.baseTable}`;

    return {
      sql: query,
      params: this.params,
    };
  }

  buildWithScore(): { sql: string; params: any[] } {
    if (!this.sql.includes('match_bm25')) {
      throw new Error('Score query requires contentQuery in filter');
    }

    const query = `
      SELECT k.*, fts_main_knowledge.match_bm25(k.id, ?) as score
      FROM ${this.baseTable} k
      WHERE ${this.sql}
    `;

    return {
      sql: query,
      params: this.params,
    };
  }
}
```

---

## MCP Server Implementation

### Server Setup

```typescript
// src/server/McpServer.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DuckDBConnection } from '@duckdb/node-api';
import { DuckDBRepository } from '../storage/DuckDBRepository';
import { KnowledgeHandler } from './handlers/KnowledgeHandler';
import { SearchHandler } from './handlers/SearchHandler';

export class McpServer {
  private server: Server;
  private repo: DuckDBRepository;
  private knowledgeHandler: KnowledgeHandler;
  private searchHandler: SearchHandler;

  constructor(conn: DuckDBConnection) {
    this.repo = new DuckDBRepository(conn);
    this.knowledgeHandler = new KnowledgeHandler(this.repo);
    this.searchHandler = new SearchHandler(this.repo);

    this.server = new Server(
      {
        name: 'beacon-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'store-knowledge',
          description: 'Store a new knowledge record (rule, decision, or documentation)',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['rule', 'decision', 'doc'],
                description: 'Type of knowledge',
              },
              path: {
                type: 'string',
                description: 'File path or directory where this knowledge applies',
              },
              scope: {
                type: 'string',
                enum: ['file', 'function', 'line', 'lineRange', 'named'],
                description: 'Optional granular scope',
              },
              scopeValue: {
                type: 'string',
                description: 'Value for scope (function name, line numbers, etc.)',
              },
              title: {
                type: 'string',
                description: 'Title of the knowledge item',
              },
              content: {
                type: 'string',
                description: 'Markdown content of the knowledge item',
              },
              library: {
                type: 'string',
                description: 'Library name (required if type=doc)',
              },
              references: {
                type: 'array',
                description: 'References to other knowledge items',
              },
            },
            required: ['type', 'path', 'title', 'content'],
          },
        },
        {
          name: 'search-knowledge',
          description: 'Search knowledge with filters and full-text search',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['rule', 'decision', 'doc'],
                description: 'Filter by type',
              },
              path: {
                type: 'string',
                description: 'File path to get knowledge for (includes ancestors)',
              },
              scope: {
                type: 'string',
                enum: ['file', 'function', 'line', 'lineRange', 'named'],
                description: 'Filter by scope',
              },
              library: {
                type: 'string',
                description: 'Filter by library (for docs)',
              },
              contentQuery: {
                type: 'string',
                description: 'Full-text search query',
              },
              includeAncestors: {
                type: 'boolean',
                description: 'Include parent path knowledge (default: true)',
              },
              limit: {
                type: 'number',
                description: 'Maximum results to return',
              },
            },
          },
        },
        {
          name: 'get-rules-for-path',
          description: 'Get all rules that apply to a specific file path',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'File path to get rules for',
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'get-decisions-for-path',
          description: 'Get all architecture decisions for a specific file path',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'File path to get decisions for',
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'get-docs-for-path',
          description: 'Get documentation for libraries used in a file path',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'File path to get docs for',
              },
              libraries: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of libraries to get docs for',
              },
            },
            required: ['filePath', 'libraries'],
          },
        },
        {
          name: 'get-all-for-path',
          description: 'Get ALL knowledge (rules, decisions, docs) for a file path',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'File path to get all knowledge for',
              },
              libraries: {
                type: 'array',
                items: { type: 'string' },
                description: 'Libraries to include docs for (optional)',
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'update-knowledge',
          description: 'Update an existing knowledge record',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'ID of the knowledge record to update',
              },
              title: { type: 'string' },
              content: { type: 'string' },
              library: { type: 'string' },
              references: { type: 'array' },
            },
            required: ['id'],
          },
        },
        {
          name: 'delete-knowledge',
          description: 'Delete a knowledge record by ID',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'ID of the knowledge record to delete',
              },
            },
            required: ['id'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'store-knowledge':
          return this.knowledgeHandler.handleStore(request.params.arguments);

        case 'search-knowledge':
          return this.searchHandler.handleSearch(request.params.arguments);

        case 'get-rules-for-path':
          return this.searchHandler.handleGetRulesForPath(request.params.arguments);

        case 'get-decisions-for-path':
          return this.searchHandler.handleGetDecisionsForPath(request.params.arguments);

        case 'get-docs-for-path':
          return this.searchHandler.handleGetDocsForPath(request.params.arguments);

        case 'get-all-for-path':
          return this.searchHandler.handleGetAllForPath(request.params.arguments);

        case 'update-knowledge':
          return this.knowledgeHandler.handleUpdate(request.params.arguments);

        case 'delete-knowledge':
          return this.knowledgeHandler.handleDelete(request.params.arguments);

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

### Tool Handlers

```typescript
// src/server/handlers/KnowledgeHandler.ts

import { DuckDBRepository } from '../../storage/DuckDBRepository';
import { StoreKnowledgeRequest } from '../../core/models/requests';

export class KnowledgeHandler {
  constructor(private repo: DuckDBRepository) {}

  async handleStore(args: any) {
    const request = args as StoreKnowledgeRequest;

    const knowledge = await this.repo.insert({
      type: request.type,
      path: request.path,
      scope: request.scope,
      scopeValue: request.scopeValue,
      title: request.title,
      content: request.content,
      library: request.library,
      references: request.references,
    } as any);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            id: knowledge.id,
            message: `Stored ${knowledge.type}: ${knowledge.title}`,
          }, null, 2),
        },
      ],
    };
  }

  async handleUpdate(args: any) {
    const { id, ...updates } = args;

    const knowledge = await this.repo.update(id, updates);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            id: knowledge.id,
            message: `Updated ${knowledge.type}: ${knowledge.title}`,
          }, null, 2),
        },
      ],
    };
  }

  async handleDelete(args: any) {
    const { id } = args;

    await this.repo.delete(id);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully deleted knowledge record ${id}`,
        },
      ],
    };
  }
}
```

```typescript
// src/server/handlers/SearchHandler.ts

import { DuckDBRepository } from '../../storage/DuckDBRepository';
import { SearchKnowledgeRequest } from '../../core/models/requests';

export class SearchHandler {
  constructor(private repo: DuckDBRepository) {}

  async handleSearch(args: any) {
    const request = args as SearchKnowledgeRequest;

    let results;

    if (request.contentQuery) {
      // Full-text search
      results = await this.repo.fullTextSearch(request.contentQuery, {
        type: request.type,
        pathPrefix: request.path,
        library: request.library,
      });
    } else if (request.path) {
      // Path-based search
      results = await this.repo.searchByPath(request.path, request.type);
    } else {
      // List all
      results = await this.repo.list(request.type);
    }

    if (request.limit) {
      results = results.slice(0, request.limit);
    }

    return {
      content: [
        {
          type: 'text',
          text: this.formatResults(results),
        },
      ],
    };
  }

  async handleGetRulesForPath(args: any) {
    const { filePath } = args;
    const rules = await this.repo.getRulesForPath(filePath);

    return {
      content: [
        {
          type: 'text',
          text: this.formatResults(rules, `Rules for ${filePath}`),
        },
      ],
    };
  }

  async handleGetDecisionsForPath(args: any) {
    const { filePath } = args;
    const decisions = await this.repo.getDecisionsForPath(filePath);

    return {
      content: [
        {
          type: 'text',
          text: this.formatResults(decisions, `Decisions for ${filePath}`),
        },
      ],
    };
  }

  async handleGetDocsForPath(args: any) {
    const { filePath, libraries } = args;
    const docs = await this.repo.getDocsForPath(filePath, libraries);

    return {
      content: [
        {
          type: 'text',
          text: this.formatResults(docs, `Documentation for ${filePath}`),
        },
      ],
    };
  }

  async handleGetAllForPath(args: any) {
    const { filePath, libraries } = args;
    const all = await this.repo.getAllForPath(filePath, libraries);

    // Group by type
    const byType = {
      rule: all.filter(k => k.type === 'rule'),
      decision: all.filter(k => k.type === 'decision'),
      doc: all.filter(k => k.type === 'doc'),
    };

    let output = `# All Knowledge for ${filePath}\n\n`;

    if (byType.rule.length > 0) {
      output += `## Rules (${byType.rule.length})\n\n`;
      byType.rule.forEach((rule, i) => {
        output += `### ${i + 1}. ${rule.title}\n`;
        output += `**Path:** \`${rule.path}\`\n\n`;
        output += `${rule.content}\n\n`;
      });
    }

    if (byType.decision.length > 0) {
      output += `## Decisions (${byType.decision.length})\n\n`;
      byType.decision.forEach((decision, i) => {
        output += `### ${i + 1}. ${decision.title}\n`;
        output += `**Path:** \`${decision.path}\`\n\n`;
        output += `${decision.content}\n\n`;
      });
    }

    if (byType.doc.length > 0) {
      output += `## Documentation (${byType.doc.length})\n\n`;
      byType.doc.forEach((doc, i) => {
        output += `### ${i + 1}. ${doc.title}\n`;
        output += `**Library:** \`${doc.library}\` | **Path:** \`${doc.path}\`\n\n`;
        output += `${doc.content}\n\n`;
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  private formatResults(results: any[], header?: string): string {
    let output = header ? `# ${header}\n\n` : '# Search Results\n\n';
    output += `Found ${results.length} result(s):\n\n`;

    results.forEach((item, i) => {
      output += `## ${i + 1}. ${item.title}\n`;
      output += `**Type:** ${item.type} | **Path:** \`${item.path}\``;

      if (item.library) {
        output += ` | **Library:** \`${item.library}\``;
      }

      if (item.score !== undefined) {
        output += ` | **Score:** ${item.score.toFixed(2)}`;
      }

      output += '\n\n';
      output += `${item.content}\n\n`;
      output += '---\n\n';
    });

    return output;
  }
}
```

---

## CLI Implementation

### CLI Architecture with Stricli

Beacon MCP uses **Stricli** for type-safe CLI command definitions. Stricli provides:

1. **Type Safety**: Arguments and options are fully typed
2. **Auto-generated Help**: Help text derived from types
3. **Route-Based Commands**: Commands organized as routes
4. **Validation**: Automatic validation of arguments
5. **Kebab-Case Support**: Converts camelCase to kebab-case automatically

### CLI Entry Point

```typescript
#!/usr/bin/env node
// src/cli/index.ts

import { buildApplication, buildRouteMap, run } from '@stricli/core';
import pkg from '../../package.json' with { type: 'json' };
import { serveCommand } from './commands/serve.js';
import { storeCommand } from './commands/store.js';
import { searchCommand } from './commands/search.js';
import { listCommand } from './commands/list.js';
import { cliLogger } from './logger.js';

// ============================================================================
// CLI Configuration
// ============================================================================

// Build the route map for commands
const routes = buildRouteMap({
  routes: {
    serve: serveCommand,
    store: storeCommand,
    search: searchCommand,
    list: listCommand,
  },
  docs: {
    brief: 'Beacon MCP: Path-based knowledge management for software development',
    fullDescription: `
      Beacon MCP provides a hierarchical knowledge management system
      designed for AI-assisted software development workflows.

      Key features:
      - Path-based knowledge retrieval (rules, decisions, documentation)
      - DuckDB storage with full-text search
      - MCP protocol integration for Claude Code
      - CLI for manual knowledge management
    `,
  },
});

// Get binary name from package.json
const binaryName =
  typeof pkg.bin === 'string' ? pkg.name : Object.keys(pkg.bin)[0];

if (!binaryName) {
  throw new Error('Binary name could not be determined from package.json');
}

// Build the main application
const app = buildApplication(routes, {
  name: binaryName,
  versionInfo: {
    currentVersion: pkg.version,
  },
  scanner: {
    caseStyle: 'allow-kebab-for-camel',
  },
  documentation: {
    caseStyle: 'convert-camel-to-kebab',
  },
});

// ============================================================================
// CLI Execution
// ============================================================================

/**
 * Main CLI execution with comprehensive error handling
 */
async function main(): Promise<void> {
  try {
    // Run the application with process arguments
    await run(app, process.argv.slice(2), { process });
  } catch (error) {
    cliLogger.error('Fatal error in CLI execution', error);
    process.exit(1);
  }
}

// Run main function and handle any synchronous errors
main().catch((error) => {
  cliLogger.error('Error occurred during CLI startup', error);
  process.exit(1);
});
```

### CLI Logger

```typescript
// src/cli/logger.ts

/**
 * Simple CLI logger for terminal output
 * Uses console.error to avoid interfering with stdout
 */
export const cliLogger = {
  info: (message: string, ...args: unknown[]) => {
    console.error(`[info] ${message}`, ...args);
  },

  warn: (message: string, ...args: unknown[]) => {
    console.error(`[warn] ${message}`, ...args);
  },

  error: (message: string, error?: unknown) => {
    console.error(`[error] ${message}`);
    if (error instanceof Error) {
      console.error(error.stack || error.message);
    } else if (error) {
      console.error(error);
    }
  },

  debug: (message: string, ...args: unknown[]) => {
    if (process.env.DEBUG) {
      console.error(`[debug] ${message}`, ...args);
    }
  },
};
```

### Serve Command (Start MCP Server)

```typescript
// src/cli/commands/serve.ts

import { buildCommand } from '@stricli/core';
import { startApp } from '../../app.js';
import { cliLogger } from '../logger.js';

export const serveCommand = buildCommand({
  docs: {
    brief: 'Start the Beacon MCP server',
    longDescription: 'Starts the MCP server and listens on stdio for requests from Claude Code or other MCP clients.',
  },
  func: async () => {
    try {
      cliLogger.info('Starting Beacon MCP server...');

      // Start application with all plugins
      const app = await startApp();

      // Server plugin provides app.server
      if (!app.server) {
        throw new Error('MCP server not initialized');
      }

      // Start the MCP server (stdio transport)
      await app.server.start();

      cliLogger.info('Beacon MCP server started successfully');

      // Keep process running
      process.on('SIGINT', async () => {
        cliLogger.info('Shutting down server...');
        await app.server!.stop();
        process.exit(0);
      });
    } catch (error) {
      cliLogger.error('Failed to start MCP server', error);
      process.exit(1);
    }
  },
});
```

### Store Command

```typescript
// src/cli/commands/store.ts

import { buildCommand, number, option, string } from '@stricli/core';
import { startApp } from '../../app.js';
import { cliLogger } from '../logger.js';
import type { KnowledgeType } from '../../types/models.js';

export const storeCommand = buildCommand({
  docs: {
    brief: 'Store a new knowledge record',
    longDescription: 'Store a rule, decision, or documentation in the knowledge base',
  },
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Knowledge type (rule, decision, or doc)',
          parse: (value) => {
            if (!['rule', 'decision', 'doc'].includes(value)) {
              throw new Error('Type must be one of: rule, decision, doc');
            }
            return value as KnowledgeType;
          },
        },
        {
          brief: 'Path where knowledge applies (e.g., src/server/api)',
          parse: string,
        },
        {
          brief: 'Title of the knowledge item',
          parse: string,
        },
        {
          brief: 'Content (markdown)',
          parse: string,
        },
      ],
    },
    flags: {
      library: option({
        brief: 'Library name (required for doc type)',
        kind: 'parsed',
        parse: string,
      }),
      scope: option({
        brief: 'Granular scope (file, function, line, lineRange, named)',
        kind: 'parsed',
        parse: string,
      }),
      scopeValue: option({
        brief: 'Value for scope (function name, line numbers, etc.)',
        kind: 'parsed',
        parse: string,
      }),
    },
  },
  async func({ positional: [type, path, title, content], flags }) {
    try {
      cliLogger.info('Storing knowledge...', { type, path, title });

      // Start application
      const app = await startApp();

      if (!app.database) {
        throw new Error('Database not initialized');
      }

      // Validate library for doc type
      if (type === 'doc' && !flags.library) {
        throw new Error('Library is required for doc type');
      }

      // Store knowledge
      const knowledge = await app.database.storeKnowledge({
        type,
        path,
        title,
        content,
        library: flags.library,
        scope: flags.scope as any,
        scopeValue: flags.scopeValue,
      });

      cliLogger.info(`✓ Stored ${knowledge.type}: ${knowledge.title} (ID: ${knowledge.id})`);

      // Cleanup
      await app.database.dispose();
    } catch (error) {
      cliLogger.error('Failed to store knowledge', error);
      process.exit(1);
    }
  },
});
```

### Search Command

```typescript
// src/cli/commands/search.ts

import { buildCommand, option, string } from '@stricli/core';
import { startApp } from '../../app.js';
import { cliLogger } from '../logger.js';

export const searchCommand = buildCommand({
  docs: {
    brief: 'Search knowledge records',
    longDescription: 'Search knowledge by path, type, or content query',
  },
  parameters: {
    flags: {
      path: option({
        brief: 'File path to search',
        kind: 'parsed',
        parse: string,
      }),
      type: option({
        brief: 'Filter by type (rule, decision, doc)',
        kind: 'parsed',
        parse: string,
      }),
      query: option({
        brief: 'Full-text search query',
        kind: 'parsed',
        parse: string,
      }),
    },
  },
  async func({ flags }) {
    try {
      const app = await startApp();

      if (!app.database) {
        throw new Error('Database not initialized');
      }

      let results;

      if (flags.path) {
        // Path-based search
        results = await app.database.searchByPath(flags.path, flags.type as any);
      } else if (flags.query) {
        // Content search
        results = await app.database.searchByContent(flags.query);
      } else {
        // List all
        results = await app.database.listKnowledge(flags.type as any);
      }

      console.log(`\nFound ${results.length} results:\n`);

      results.forEach((item, i) => {
        console.log(`${i + 1}. ${item.title}`);
        console.log(`   Type: ${item.type} | Path: ${item.path}`);
        console.log(`   ${item.content.substring(0, 100)}...\n`);
      });

      await app.database.dispose();
    } catch (error) {
      cliLogger.error('Search failed', error);
      process.exit(1);
    }
  },
});
```

### List Command

```typescript
// src/cli/commands/list.ts

import { buildCommand, option, string } from '@stricli/core';
import { startApp } from '../../app.js';
import { cliLogger } from '../logger.js';

export const listCommand = buildCommand({
  docs: {
    brief: 'List all knowledge records',
    longDescription: 'List all knowledge records, optionally filtered by type',
  },
  parameters: {
    flags: {
      type: option({
        brief: 'Filter by type (rule, decision, doc)',
        kind: 'parsed',
        parse: string,
      }),
    },
  },
  async func({ flags }) {
    try {
      const app = await startApp();

      if (!app.database) {
        throw new Error('Database not initialized');
      }

      const results = await app.database.listKnowledge(flags.type as any);

      console.log(`\nFound ${results.length} knowledge records:\n`);

      results.forEach((item, i) => {
        console.log(`${i + 1}. ${item.title}`);
        console.log(`   Type: ${item.type} | Path: ${item.path}`);
        if (item.library) {
          console.log(`   Library: ${item.library}`);
        }
        console.log('');
      });

      await app.database.dispose();
    } catch (error) {
      cliLogger.error('List failed', error);
      process.exit(1);
    }
  },
});
```

---

## User Workflows

### Workflow 1: Adding a Global Rule

**Scenario:** Add a project-wide rule about TypeScript strict mode.

**Using CLI:**

```bash
beacon store
# Interactive prompts:
# ? Knowledge type: rule
# ? Path: .
# ? Title: TypeScript Strict Mode
# ? Content source: Type now
# ? Content: All TypeScript files must use strict mode.

# Output:
# ✓ Stored rule: TypeScript Strict Mode (ID: abc-123)
```

**Using MCP (via Claude Code):**

```
User: "Add a global rule that we must use TypeScript strict mode"

Claude calls:
store-knowledge({
  type: "rule",
  path: ".",
  title: "TypeScript Strict Mode",
  content: "All TypeScript files must use strict mode. Configure in tsconfig.json..."
})

Response:
✓ Stored rule: TypeScript Strict Mode (ID: abc-123)
```

### Workflow 2: Getting Context for a File

**Scenario:** Claude Code starts working on `src/server/api/users.ts` and needs to know what rules apply.

**Using MCP:**

```
Claude calls:
get-all-for-path({
  filePath: "src/server/api/users.ts",
  libraries: ["zod", "express"]
})

Response:
# All Knowledge for src/server/api/users.ts

## Rules (3)

### 1. TypeScript Strict Mode
**Path:** `.`

All TypeScript files must use strict mode...

### 2. API Input Validation
**Path:** `src/server/api`

All API handlers must validate input using Zod schemas...

### 3. Error Handling
**Path:** `src/server`

All server code must use our custom error classes...

## Documentation (2)

### 1. Zod Schema Patterns
**Library:** `zod` | **Path:** `src/server`

Common Zod patterns for API validation...

### 2. Express Best Practices
**Library:** `express` | **Path:** `src/server/api`

Express middleware patterns we use...
```

Claude now has **all relevant context** loaded automatically based on the file location!

---

## Implementation Phases

### Phase 1: Core Storage & Retrieval (Week 1-2)

**Goals:**
- Basic DuckDB storage setup
- Schema creation with migrations
- Path hierarchy resolution
- Glob pattern matching with SQL LIKE
- Granular scoping (function, line, etc.)
- Simple CRUD operations

**Deliverables:**
- `src/core/models` - TypeScript types with Scope and References
- `src/storage` - DuckDB repository with schema migrations
- `src/query` - Path hierarchy resolver and query builder
- `src/parser` - Path scope parser (parse `file:function`, `file:104-150`, etc.)
- Unit tests for core functionality

**Acceptance Criteria:**
- Can store knowledge records with all scope types
- DuckDB schema created with proper constraints
- Can retrieve rules by path hierarchy using SQL queries
- Glob patterns work via SQL LIKE (including exclusions with `NOT LIKE`)
- Granular scoping works (function, line, lineRange, named)
- Tests passing for path ancestor resolution and SQL queries

**DuckDB-Specific Tasks:**
- Create table with CHECK constraints for enums
- Set up indexes on type, path, library columns
- Implement JSON column for references
- Test query performance (should be <15ms for path queries)

### Phase 2: MCP Server (Week 3-4)

**Goals:**
- MCP server with stdio transport
- Unified search tool with hybrid queries
- FTS extension integration
- References system working
- Integration with Claude Code

**Deliverables:**
- `src/server` - MCP server setup
- `src/server/index.ts` - Server entry point
- MCP tools:
  - `store-knowledge` - INSERT into DuckDB
  - `search-knowledge` - Hybrid queries (path + FTS)
  - `update-knowledge` - UPDATE records
  - `delete-knowledge` - DELETE records
  - `get-references` - Find referencing documents
- Reference parser and validator
- Integration tests

**Acceptance Criteria:**
- MCP server runs and responds to tools
- `search-knowledge` supports:
  - Path hierarchy queries (required)
  - SQL LIKE patterns (required)
  - Full-text search via FTS extension
  - Hybrid queries combining filters
- References work (validated, backlinks generated)
- Can store/retrieve via MCP protocol
- Claude Code integration working

**DuckDB-Specific Features:**
- PRAGMA create_fts_index setup
- BM25 scoring for relevance
- Parameterized queries for SQL injection prevention

### Phase 3: CLI (Week 5)

**Goals:**
- Full CLI with all commands
- Pretty output with chalk/ora
- Import/export functionality
- Interactive prompts with enquirer

**Deliverables:**
- `src/cli` - CLI commands
- `src/cli/index.ts` - CLI entry point with commander
- Markdown parser with frontmatter support
- Batch import functionality

**Acceptance Criteria:**
- All CLI commands working
- Can import from markdown files (batch INSERT)
- Colored/formatted output
- Interactive prompts for better UX
- Batch operations perform well (100+ docs in <1 second)

**DuckDB-Specific Features:**
- Transaction support for batch imports
- Progress indicators for long operations

### Phase 4: Advanced Features (Week 6+)

**Goals:**
- Rule exceptions system
- Analytics queries
- Performance optimizations
- Documentation and examples

**Deliverables:**
- Exception records and validation
- In-code exception detection (`// @beacon-ignore`)
- Analytics queries (GROUP BY aggregations)
- Performance benchmarks
- User documentation
- Example projects

**Acceptance Criteria:**
- Exceptions work (can ignore rules at specific locations)
- Exception validation prevents invalid references
- Analytics show counts by type, library, path
- Fast queries (<15ms for typical project)
- Documentation complete with real-world examples

**DuckDB-Specific Advanced Features:**

1. **Analytics Queries**
   ```sql
   -- Get knowledge counts by type
   SELECT type, COUNT(*) as count
   FROM knowledge
   GROUP BY type;

   -- Get most documented libraries
   SELECT library, COUNT(*) as doc_count
   FROM knowledge
   WHERE type = 'doc'
   GROUP BY library
   ORDER BY doc_count DESC;

   -- Get path coverage
   SELECT
     SUBSTRING(path, 1, POSITION('/' IN path || '/') - 1) as top_level,
     COUNT(*) as count
   FROM knowledge
   GROUP BY top_level;
   ```

2. **Time-based Queries**
   ```sql
   -- Knowledge added in last 30 days
   SELECT * FROM knowledge
   WHERE created_at > CURRENT_TIMESTAMP - INTERVAL 30 DAY;

   -- Most recently updated
   SELECT * FROM knowledge
   ORDER BY updated_at DESC
   LIMIT 10;
   ```

3. **Export Features**
   ```sql
   -- Export to CSV
   COPY (SELECT * FROM knowledge) TO 'knowledge.csv' (HEADER, DELIMITER ',');

   -- Export to JSON
   COPY (SELECT * FROM knowledge) TO 'knowledge.json';

   -- Export to Parquet
   COPY (SELECT * FROM knowledge) TO 'knowledge.parquet' (FORMAT PARQUET);
   ```

---

## Performance Considerations

### Expected Performance

**Database Size:**
- Small project: 50-100 records
  - Raw data: ~500KB
  - DuckDB file: ~600-700KB (minimal overhead)
- Medium project: 500-1000 records
  - Raw data: ~5MB
  - DuckDB file: ~5.5-6MB
- Large project: 5000+ records
  - Raw data: ~50MB
  - DuckDB file: ~55-60MB

**Query Performance:**
- Path hierarchy query: 5-15ms (indexed lookups)
- Full-text search: 10-50ms (FTS extension)
- Hybrid query (path + FTS): 15-60ms
- Glob/LIKE query: 10-30ms
- Aggregation query: 20-80ms
- Insert/Update: 5-20ms
- Batch insert (100 items): 200-500ms (with transaction)

**Memory Usage:**
- DuckDB memory footprint: ~20-50MB
- Query execution: ~1-5MB per concurrent query
- Typical small project: 30-70MB RAM total

### DuckDB-Specific Optimizations

1. **Index Configuration**
   ```typescript
   // Create indexes on frequently queried columns
   await conn.run(`CREATE INDEX idx_type ON knowledge(type)`);
   await conn.run(`CREATE INDEX idx_path ON knowledge(path)`);
   await conn.run(`CREATE INDEX idx_library ON knowledge(library)`);
   ```

2. **Query Optimization**
   ```typescript
   // Use parameterized queries (prevents SQL injection + query plan caching)
   const result = await conn.runAndReadAll(
     `SELECT * FROM knowledge WHERE type = ? AND path IN (?, ?, ?)`,
     ['rule', '.', 'src', 'src/server']
   );

   // Use EXPLAIN to analyze query plans
   const plan = await conn.runAndReadAll(`EXPLAIN SELECT * FROM knowledge WHERE type = 'rule'`);
   console.log(plan.getRowObjects());
   ```

3. **Batch Operations**
   ```typescript
   // Use transactions for batch inserts
   await conn.run(`BEGIN TRANSACTION`);

   for (const item of items) {
     await conn.run(
       `INSERT INTO knowledge (...) VALUES (?, ?, ?, ...)`,
       [item.id, item.type, item.path, ...]
     );
   }

   await conn.run(`COMMIT`);
   ```

4. **FTS Optimization**
   ```typescript
   // Configure FTS index with appropriate settings
   await conn.run(`
     PRAGMA create_fts_index(
       'knowledge',
       'id',
       'title',
       'content',
       stemmer = 'porter',      // English stemming
       stopwords = 'english',   // Remove common words
       strip_accents = 1,       // Normalize accents
       lower = 1,               // Case-insensitive
       overwrite = 0            // Don't recreate if exists
     )
   `);
   ```

5. **Result Limiting**
   ```typescript
   // Always use LIMIT for large result sets
   const results = await conn.runAndReadAll(`
     SELECT * FROM knowledge
     WHERE type = 'rule'
     ORDER BY created_at DESC
     LIMIT 20
   `);
   ```

6. **Connection Pooling**
   ```typescript
   // Reuse connections instead of creating new ones
   export class ConnectionPool {
     private static instance: DuckDBConnection;

     static async getConnection(): Promise<DuckDBConnection> {
       if (!this.instance) {
         const db = await DuckDBInstance.create('beacon.duckdb');
         this.instance = await db.connect();
       }
       return this.instance;
     }
   }
   ```

### Caching Strategies

1. **Path Ancestor Caching**
   ```typescript
   import { LRUCache } from 'lru-cache';

   const ancestorCache = new LRUCache<string, string[]>({ max: 1000 });

   export function getPathAncestors(filePath: string): string[] {
     if (ancestorCache.has(filePath)) {
       return ancestorCache.get(filePath)!;
     }

     const ancestors = calculateAncestors(filePath);
     ancestorCache.set(filePath, ancestors);
     return ancestors;
   }
   ```

2. **Query Result Caching**
   ```typescript
   class CachedRepository extends DuckDBRepository {
     private cache = new LRUCache<string, Knowledge[]>({ max: 100 });

     async getRulesForPath(filePath: string): Promise<Knowledge[]> {
       const cacheKey = `rules:${filePath}`;

       if (this.cache.has(cacheKey)) {
         return this.cache.get(cacheKey)!;
       }

       const results = await super.getRulesForPath(filePath);
       this.cache.set(cacheKey, results);
       return results;
     }

     invalidate() {
       this.cache.clear();
     }
   }
   ```

### Performance Monitoring

**Key Metrics to Track:**

1. **Query Latency**
   ```typescript
   async function timedQuery<T>(fn: () => Promise<T>): Promise<T> {
     const start = Date.now();
     const result = await fn();
     const duration = Date.now() - start;
     console.log(`Query took ${duration}ms`);
     return result;
   }

   const results = await timedQuery(() => repo.getRulesForPath('src/server/api.ts'));
   ```

2. **Database Size**
   ```bash
   ls -lh beacon.duckdb
   ```

3. **Memory Usage**
   ```typescript
   console.log(`Memory usage: ${process.memoryUsage().heapUsed / 1024 / 1024}MB`);
   ```

---

## Security & Validation

### Input Validation

```typescript
// src/core/validation/validator.ts

import { Knowledge } from '../models/types';
import path from 'path';

export class PathValidator {
  static validate(inputPath: string): void {
    // Prevent directory traversal
    const normalized = path.normalize(inputPath);
    if (normalized.includes('..')) {
      throw new Error('Invalid path: contains ".."');
    }

    // Prevent absolute paths (unless it's ".")
    if (path.isAbsolute(inputPath) && inputPath !== '.') {
      throw new Error('Path must be relative');
    }

    // Prevent null bytes
    if (inputPath.includes('\0')) {
      throw new Error('Invalid path: contains null byte');
    }
  }
}

export class KnowledgeValidator {
  static validate(k: Partial<Knowledge>): void {
    if (!k.type || !['rule', 'decision', 'doc'].includes(k.type)) {
      throw new Error(`Invalid type: ${k.type}`);
    }

    if (!k.path) {
      throw new Error('path is required');
    }

    PathValidator.validate(k.path);

    if (!k.title || k.title.length === 0) {
      throw new Error('title is required');
    }

    if (k.title.length > 200) {
      throw new Error('title must be <= 200 characters');
    }

    if (!k.content || k.content.length === 0) {
      throw new Error('content is required');
    }

    if (k.content.length > 100000) {
      throw new Error('content must be <= 100,000 characters');
    }

    if (k.type === 'doc' && !k.library) {
      throw new Error('library is required for doc type');
    }

    // Validate scope
    if (k.scope && !['file', 'function', 'line', 'lineRange', 'named'].includes(k.scope)) {
      throw new Error(`Invalid scope: ${k.scope}`);
    }

    if (k.scope && k.scope !== 'file' && !k.scopeValue) {
      throw new Error(`scope ${k.scope} requires scopeValue`);
    }
  }
}
```

### SQL Injection Prevention

```typescript
// ✅ ALWAYS use parameterized queries
const results = await conn.runAndReadAll(
  `SELECT * FROM knowledge WHERE type = ?`,
  [userInput]
);

// ❌ NEVER concatenate user input into SQL
// const results = await conn.runAndReadAll(
//   `SELECT * FROM knowledge WHERE type = '${userInput}'`
// );
```

### Security Considerations

1. **No user authentication** - This is a local development tool, authentication handled by OS/filesystem
2. **Path sanitization** - Prevent directory traversal attacks
3. **Input validation** - Validate all inputs before database operations
4. **No remote access** - MCP server only accessible via stdio (local process)
5. **Parameterized queries** - Prevent SQL injection
6. **File system permissions** - Database file should be readable only by user

---

## Conclusion

Beacon MCP solves a real problem for AI-assisted development: providing location-aware context injection for software projects. By embracing the hierarchical nature of codebases and using path-based retrieval enhanced with full-text search, it offers:

✅ **Simplicity** - SQL queries, no embeddings, no external APIs
✅ **Performance** - Fast queries, 5-15ms for path queries, 10-50ms for FTS
✅ **Determinism** - Same file → same rules, every time
✅ **Developer-friendly** - SQL and file tree mental model
✅ **Zero dependencies** - Single DuckDB file, no external services
✅ **TypeScript-native** - Async/await, strong typing, Node.js ecosystem
✅ **Future-proof** - SQL enables complex analytics and reporting

### Why DuckDB Was the Right Choice

**Decision made:** Use DuckDB instead of Bleve/BoltDB

**Rationale:**
1. **SQL + full-text search** - DuckDB does both, familiar SQL syntax
2. **TypeScript integration** - Official @duckdb/node-api package
3. **Embedded database** - Single file, zero configuration
4. **Analytics capabilities** - GROUP BY, aggregations, JOINS
5. **Export features** - CSV, JSON, Parquet built-in
6. **Performance** - Vectorized execution, optimized for OLAP
7. **Ecosystem fit** - Works perfectly with other TypeScript tools

**Trade-offs accepted:**
- Slightly larger file size than pure JSON
- SQL knowledge required (but most developers know SQL)
- Single-threaded writes (acceptable for development tool)

**What we gained:**
- ✅ SQL queries (powerful, flexible, familiar)
- ✅ FTS extension with BM25 scoring
- ✅ ACID transactions
- ✅ JSON column support
- ✅ Analytics queries (GROUP BY, aggregations)
- ✅ Export to CSV/JSON/Parquet
- ✅ Future: Window functions, CTEs, complex joins

### Use DuckDB to Its Fullest Potential

**Core Beacon MCP Features (Enabled by DuckDB):**

1. **Hierarchical Path Queries**
   - Use `IN` clause with ancestor list
   - Fast indexed lookups

2. **Glob Pattern Matching**
   - Use `LIKE` for patterns (`%test.ts`)
   - Use `NOT LIKE` for exclusions

3. **Full-Text Search**
   - FTS extension with Porter stemming
   - BM25 relevance scoring
   - Stopwords filtering

4. **Hybrid Queries**
   - Combine path filters + type filters + FTS
   - Single SQL query execution

5. **Analytics**
   - GROUP BY for counts
   - Window functions for rankings
   - CTEs for complex queries

**Product-Specific Features Using DuckDB:**

**Phase 1 (Core):**
- Path hierarchy via SQL IN clause
- Glob matching via LIKE
- Type filtering via CHECK constraints

**Phase 2 (MCP Server):**
- Hybrid search (path + FTS in one query)
- BM25 scoring for relevance
- Reference validation via foreign keys

**Phase 3 (CLI):**
- Batch import with transactions
- Export to CSV/JSON/Parquet
- Analytics dashboard queries

**Phase 4 (Advanced):**
- **Rule Discovery**: FTS fuzzy matching
- **Time-based Queries**: Filter by created_at/updated_at
- **Path Analytics**: GROUP BY path prefix
- **Export Pipeline**: Automated exports for CI/CD

---

## Architectural Improvements from Production Patterns

This implementation plan incorporates proven architectural patterns from the dfm_src codebase (nano-rag-mcp), a production-tested TypeScript MCP server. These patterns provide significant advantages for maintainability, testability, and scalability.

### Why These Patterns Matter

**1. Avvio Lifecycle Management**
- **What**: Plugin-based application bootstrap with lifecycle hooks
- **Why**: Proven at scale by Fastify (handles millions of requests/sec in production)
- **Benefit**: Clean dependency injection, deterministic startup order, graceful shutdown

**2. Plugin Architecture**
- **What**: Services registered as independent plugins with explicit dependencies
- **Why**: Enforces separation of concerns and makes testing easier
- **Benefit**: Each plugin can be tested in isolation, services can be mocked

**3. Factory Pattern for Services**
- **What**: Services created by factory functions that return interfaces
- **Why**: Decouples interface from implementation
- **Benefit**: Easy to swap implementations (e.g., mock database for tests)

**4. Type-Safe CLI with Stricli**
- **What**: Route-based CLI with auto-generated help and type-safe arguments
- **Why**: Eliminates runtime errors from invalid arguments
- **Benefit**: IDE autocomplete, compile-time validation, consistent UX

**5. Structured Error Handling**
- **What**: Custom error classes with codes and context
- **Why**: Makes debugging and error reporting consistent
- **Benefit**: Easy to filter/categorize errors, better error messages

### Architecture Comparison

**Before (Simple Approach):**
```typescript
// Everything in one file, tightly coupled
import { DuckDBConnection } from '@duckdb/node-api';

const conn = await createConnection();
const repo = new DuckDBRepository(conn);
const server = new McpServer(repo);
await server.start();
```

**Problems:**
- Hard to test (can't mock conn or repo)
- No lifecycle management (what if DB init fails?)
- Tight coupling (changing DB requires changing server)
- No logging or error handling

**After (Plugin Architecture):**
```typescript
// Plugins registered in dependency order
import { startApp } from './app.js';

const app = await startApp();
// Database plugin initialized
// Logger plugin initialized
// Query engine plugin initialized
// MCP server plugin initialized

await app.server.start();
```

**Benefits:**
- Each plugin tests independently
- Clear error handling at each stage
- Logging throughout initialization
- Graceful shutdown (plugins can cleanup)
- Services are mockable interfaces

### Real-World Impact

**1. Testing**
```typescript
// Before: Hard to test
test('should store knowledge', async () => {
  const conn = await createRealDatabase(); // Slow, requires cleanup
  const repo = new DuckDBRepository(conn);
  // ...
});

// After: Easy to mock
test('should store knowledge', async () => {
  const mockDb = createMockDatabase(); // Fast, in-memory
  const app = await startApp({ database: mockDb });
  // ...
});
```

**2. Error Handling**
```typescript
// Before: Unclear errors
Error: Failed to query
  at unknown location

// After: Clear context
PluginInitError: Failed to initialize Database plugin: Connection failed
  at databasePlugin (src/plugins/database.ts:25)
  cause: ConfigError: databasePath not found in configuration
```

**3. Development Experience**
```typescript
// Before: Manual dependency management
const config = loadConfig();
const logger = createLogger(config);
const db = createDatabase(config, logger); // Easy to forget logger

// After: Automatic dependency injection
app.use(configPlugin);  // Provides app.config
app.use(loggerPlugin);  // Uses app.config, provides app.logger
app.use(databasePlugin); // Uses app.config + app.logger, provides app.database
```

### Migration Path

**Phase 1 Implementation:**
1. Set up avvio + plugin structure
2. Create config, logger, database plugins
3. Implement database factory pattern
4. Add custom error types

**Phase 2 (MCP Server):**
5. Create MCP server plugin
6. Implement tool handlers
7. Add structured error responses

**Phase 3 (CLI):**
8. Set up Stricli CLI
9. Create serve, store, search commands
10. Add CLI logger

**Phase 4 (Testing):**
11. Create mock implementations
12. Write unit tests for each plugin
13. Integration tests with real DuckDB

### Key Takeaways

1. **Production-Tested**: These patterns are used in production MCP servers
2. **Developer Experience**: Better errors, logging, and debugging
3. **Maintainability**: Clear separation of concerns
4. **Testability**: Easy to mock and test in isolation
5. **Scalability**: Can add new plugins without touching existing code

---

### Next Steps

1. Review and refine this design document
2. Set up TypeScript project structure
3. Install @duckdb/node-api dependency
4. Begin Phase 1 implementation (DuckDB schema + path queries)
5. Test query performance against benchmarks
6. Iterate based on real usage

---

**Document Version:** 1.0 (TypeScript + DuckDB)
**Last Updated:** 2025-01-31
**Authors:** AI Assistant (Claude) + User (takinprofit)
