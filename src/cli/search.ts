import { buildCommand } from "@stricli/core"
import { startApp } from "../app.js"
import type { KnowledgeEntry } from "../types/knowledge.js"
import {
  KnowledgePathSchema,
  type KnowledgeType,
  KnowledgeTypeSchema,
} from "../types/knowledge.js"
import type { SearchResult, SearchResults } from "../types/search.js"
import { SearchQuerySchema } from "../types/search.js"
import { cliLogger } from "./logger.js"

type SearchFlags = {
  path?: string
  query?: string
  type?: KnowledgeType
}

type ListResult = KnowledgeEntry

const SNIPPET_LENGTH = 280
const SCORE_DECIMAL_PLACES = 3

const parseTrimmed = (value: string): string => value.trim()

const parsePath = (value: string): string =>
  KnowledgePathSchema.parse(parseTrimmed(value))

const parseType = (value: string): KnowledgeType =>
  KnowledgeTypeSchema.parse(parseTrimmed(value))

const buildSnippet = (source: string): string => {
  const normalized = source.trim()
  if (normalized.length <= SNIPPET_LENGTH) {
    return normalized
  }
  return `${normalized.slice(0, SNIPPET_LENGTH - 1)}…`
}

const selectSnippet = (result: SearchResult): string | undefined => {
  if (result.snippets?.length) {
    const [snippet] = result.snippets
    if (typeof snippet === "string" && snippet.length > 0) {
      return buildSnippet(snippet)
    }
  }

  const content = result.entry.content
  return content.length > 0 ? buildSnippet(content) : undefined
}

const formatSearchResult = (result: SearchResult, index: number): string => {
  const lines = [
    `### ${index}. ${result.entry.title}`,
    `- **Type:** ${result.entry.type}`,
    `- **Path:** ${result.entry.path}`,
    `- **Score:** ${result.score.toFixed(SCORE_DECIMAL_PLACES)}`,
  ]

  if (result.matchExplanation) {
    lines.push(`- **Explanation:** ${result.matchExplanation}`)
  }

  const snippet = selectSnippet(result)
  if (snippet) {
    lines.push("", "```", snippet, "```")
  }

  return `${lines.join("\n")}\n`
}

const formatSearchResults = (results: SearchResults): string => {
  const header = `# Search Results\n\nDisplaying ${results.results.length} of ${results.total} result${
    results.total === 1 ? "" : "s"
  } (offset ${results.offset}, limit ${results.limit}) in ${results.executionTime.toFixed(
    2
  )}ms.`

  if (results.results.length === 0) {
    return `${header}\n\nNo results matched the provided criteria.\n`
  }

  const body = results.results
    .map((result, index) => formatSearchResult(result, index + 1))
    .join("\n")

  return `${header}\n\n${body}`
}

const formatListResults = (
  entries: ListResult[],
  type?: KnowledgeType
): string => {
  const headerParts = [
    "# Knowledge Entries",
    `Found ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`,
  ]

  if (type) {
    headerParts.push(`Filtered by type: ${type}`)
  }

  if (entries.length === 0) {
    return `${headerParts.join("\n")}\n\nNo entries available.\n`
  }

  const body = entries
    .map((entry, index) => {
      const lines = [
        `### ${index + 1}. ${entry.title}`,
        `- **Type:** ${entry.type}`,
        `- **Path:** ${entry.path}`,
      ]

      if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        lines.push("- **Metadata:**")
        for (const [key, value] of Object.entries(entry.metadata)) {
          lines.push(`  - ${key}: ${JSON.stringify(value)}`)
        }
      }

      lines.push("", buildSnippet(entry.content))
      return `${lines.join("\n")}\n`
    })
    .join("\n")

  return `${headerParts.join("\n")}\n\n${body}`
}

const disposeDatabase = async (entry?: {
  dispose(): Promise<void>
}): Promise<void> => {
  if (!entry) {
    return
  }

  try {
    await entry.dispose()
  } catch (error) {
    cliLogger.error("Failed to dispose database", error)
  }
}

export const searchCommand = buildCommand<SearchFlags>({
  parameters: {
    flags: {
      path: {
        kind: "parsed",
        parse: parsePath,
        brief: "Exact knowledge path to search",
        optional: true,
      },
      query: {
        kind: "parsed",
        parse: parseTrimmed,
        brief: "Full-text content query",
        optional: true,
      },
      type: {
        kind: "parsed",
        parse: parseType,
        brief: "Filter by knowledge type",
        optional: true,
      },
    },
  },
  docs: {
    brief: "Search knowledge entries",
    fullDescription: `
Search Beacon knowledge by path or content. Provide --path for hierarchical queries or --query for full-text search.
Use --type to restrict results to a specific knowledge category.
`,
    customUsage: [
      {
        input: "search --path /src/api/users",
        brief: "Find entries for a specific path",
      },
      {
        input: 'search --query "audit log" --type decision',
        brief: "Search content for decisions mentioning audit logs",
      },
    ],
  },
  async func(flags): Promise<void> {
    let app: Awaited<ReturnType<typeof startApp>> | undefined

    try {
      cliLogger.info("Starting search command", {
        path: flags.path ?? null,
        query: flags.query ?? null,
        type: flags.type ?? null,
      })

      app = await startApp()

      if (!app.database) {
        throw new Error("Database not initialized")
      }

      const hasSearchCriteria = Boolean(flags.path || flags.query)

      if (!hasSearchCriteria) {
        const entries = await app.database.listKnowledge(flags.type)
        const output = formatListResults(entries, flags.type)
        process.stdout.write(`${output}\n`)
        cliLogger.info("List query completed", {
          results: entries.length,
          type: flags.type ?? null,
        })
        return
      }

      if (!app.queryEngine) {
        throw new Error("Query engine not initialized")
      }

      const searchQuery = SearchQuerySchema.parse({
        ...(flags.path ? { path: flags.path } : {}),
        ...(flags.query ? { content: flags.query } : {}),
        ...(flags.type ? { type: flags.type } : {}),
      })

      const results = await app.queryEngine.executeSearch(searchQuery, {
        includeSnippets: Boolean(flags.query),
        filters: flags.type ? { type: flags.type } : undefined,
      })

      const output = formatSearchResults(results)
      process.stdout.write(`${output}\n`)

      cliLogger.info("Search query completed", {
        displayed: results.results.length,
        total: results.total,
        offset: results.offset,
        limit: results.limit,
        executionTime: results.executionTime,
      })
    } catch (error) {
      cliLogger.error("Search command failed", error)
      process.exitCode = 1
    } finally {
      await disposeDatabase(app?.database)
    }
  },
})
