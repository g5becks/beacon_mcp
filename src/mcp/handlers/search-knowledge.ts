import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { Logger } from "../../types/logger.js"
import type {
  SearchKnowledgeToolInput,
  SearchKnowledgeToolOutput,
} from "../../types/mcp-tools.js"
import type { QueryEngine } from "../../types/query-engine.js"
import type { SearchResult, SearchResults } from "../../types/search.js"
import {
  createErrorResult,
  createSuccessResult,
  toToolError,
} from "../utils/results.js"

export type SearchKnowledgeHandlerDependencies = {
  queryEngine: QueryEngine
  logger: Logger
}

const SNIPPET_MAX_LENGTH = 280
const SCORE_DECIMAL_PLACES = 3

const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 1)}…`
}

const formatSnippet = (result: SearchResult): string | undefined => {
  if (result.snippets && result.snippets.length > 0) {
    const [firstSnippet] = result.snippets
    if (typeof firstSnippet === "string" && firstSnippet.length > 0) {
      return truncate(firstSnippet, SNIPPET_MAX_LENGTH)
    }
  }

  const content = result.entry.content
  return content.length > 0
    ? truncate(content.trim(), SNIPPET_MAX_LENGTH)
    : undefined
}

const formatMatchedFields = (fields: SearchResult["matchedFields"]): string =>
  fields.length > 0 ? fields.join(", ") : "n/a"

const formatResult = (result: SearchResult, index: number): string => {
  const snippet = formatSnippet(result)
  const parts = [
    `### ${index}. ${result.entry.title}`,
    `- **Path:** ${result.entry.path}`,
    `- **Type:** ${result.entry.type}`,
    `- **Score:** ${result.score.toFixed(SCORE_DECIMAL_PLACES)}`,
    `- **Matched Fields:** ${formatMatchedFields(result.matchedFields)}`,
  ]

  if (result.matchExplanation) {
    parts.push(`- **Explanation:** ${result.matchExplanation}`)
  }

  if (snippet && snippet.length > 0) {
    parts.push("", "```", snippet, "```")
  }

  return parts.join("\n")
}

const formatSearchResults = (results: SearchResults): string => {
  const header = `# Search Results\n\nFound ${results.results.length} of ${results.total} results (offset ${results.offset}, limit ${results.limit}) in ${results.executionTime.toFixed(2)}ms.`

  if (results.results.length === 0) {
    return `${header}\n\nNo results matched the provided criteria.`
  }

  const formatted = results.results
    .map((result, index) => formatResult(result, index + 1))
    .join("\n\n")

  return `${header}\n\n${formatted}`
}

const buildSuccessPayload = (
  results: SearchResults
): SearchKnowledgeToolOutput => results

export const createSearchKnowledgeHandler =
  ({
    queryEngine,
    logger,
  }: SearchKnowledgeHandlerDependencies): ((
    input: SearchKnowledgeToolInput
  ) => Promise<CallToolResult>) =>
  async (input) => {
    try {
      const results = await queryEngine.executeSearch(input)

      const message = formatSearchResults(results)

      logger.info(
        {
          scope: "search-knowledge",
          filters: {
            path: input.path,
            pattern: input.pattern,
            type: input.type,
            includeAncestors: input.includeAncestors,
          },
          contentQuery: input.content,
          returned: results.results.length,
          total: results.total,
          executionTime: results.executionTime,
          limit: results.limit,
          offset: results.offset,
        },
        "search-knowledge succeeded"
      )

      return createSuccessResult(buildSuccessPayload(results), message)
    } catch (error) {
      const toolError = toToolError(error)
      logger.error(
        {
          scope: "search-knowledge",
          err: error,
          filters: {
            path: input.path,
            pattern: input.pattern,
            type: input.type,
            includeAncestors: input.includeAncestors,
          },
          contentQuery: input.content,
        },
        "search-knowledge failed"
      )
      return createErrorResult(toolError)
    }
  }
