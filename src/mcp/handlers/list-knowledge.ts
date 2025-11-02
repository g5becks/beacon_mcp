import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { Database } from "../../types/database.js"
import type { Logger } from "../../types/logger.js"
import type {
  ListKnowledgeToolInput,
  ListKnowledgeToolOutput,
} from "../../types/mcp-tools.js"
import {
  createErrorResult,
  createSuccessResult,
  toToolError,
} from "../utils/results.js"

export type ListKnowledgeHandlerDependencies = {
  database: Database
  logger: Logger
}

const formatEntry = (
  entry: ListKnowledgeToolOutput["entries"][number],
  index: number
): string => {
  const lines = [
    `### ${index}. ${entry.title}`,
    `- **ID:** ${entry.id}`,
    `- **Path:** ${entry.path}`,
    `- **Type:** ${entry.type}`,
  ]

  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    lines.push(
      "- **Metadata:**",
      ...Object.entries(entry.metadata).map(
        ([key, value]) => `  - ${key}: ${JSON.stringify(value)}`
      )
    )
  }

  lines.push("", entry.content)

  return lines.join("\n")
}

const formatListMessage = (
  entries: ListKnowledgeToolOutput["entries"],
  type?: string
): string => {
  const headerParts = [
    "# Knowledge Entries",
    `Found ${entries.length} entr${entries.length === 1 ? "y" : "ies"}`,
  ]

  if (type) {
    headerParts.push(`Filtered by type: ${type}`)
  }

  const header = headerParts.join("\n")

  if (entries.length === 0) {
    return `${header}\n\nNo entries available.`
  }

  const body = entries
    .map((entry, index) => formatEntry(entry, index + 1))
    .join("\n\n")

  return `${header}\n\n${body}`
}

export const createListKnowledgeHandler =
  ({
    database,
    logger,
  }: ListKnowledgeHandlerDependencies): ((
    input: ListKnowledgeToolInput
  ) => Promise<CallToolResult>) =>
  async (input) => {
    try {
      const entries = await database.listKnowledge(input.type)

      logger.info(
        {
          scope: "list-knowledge",
          filter: input.type ?? null,
          count: entries.length,
        },
        "list-knowledge executed"
      )

      const payload: ListKnowledgeToolOutput = {
        entries,
      }

      const message = formatListMessage(entries, input.type)

      return createSuccessResult(payload, message)
    } catch (error) {
      const toolError = toToolError(error)
      logger.error(
        {
          scope: "list-knowledge",
          filter: input.type ?? null,
          err: error,
        },
        "list-knowledge failed"
      )
      return createErrorResult(toolError)
    }
  }
