import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { Database } from "../../types/database.js"
import type { Logger } from "../../types/logger.js"
import type {
  GetKnowledgeToolInput,
  GetKnowledgeToolOutput,
} from "../../types/mcp-tools.js"
import {
  createErrorResult,
  createSuccessResult,
  toToolError,
} from "../utils/results.js"

export type GetKnowledgeHandlerDependencies = {
  database: Database
  logger: Logger
}

const formatSuccessMessage = (
  entry: GetKnowledgeToolOutput["entry"],
  id: string
): string => {
  if (entry) {
    const lines = [
      "# Knowledge Entry",
      `- **ID:** ${entry.id}`,
      `- **Path:** ${entry.path}`,
      `- **Type:** ${entry.type}`,
      `- **Title:** ${entry.title}`,
      "",
      entry.content,
    ]

    return lines.join("\n")
  }

  return `No knowledge entry found with ID ${id}`
}

export const createGetKnowledgeHandler =
  ({
    database,
    logger,
  }: GetKnowledgeHandlerDependencies): ((
    input: GetKnowledgeToolInput
  ) => Promise<CallToolResult>) =>
  async (input) => {
    try {
      const entry = await database.getKnowledge(input.id)

      logger.info(
        {
          scope: "get-knowledge",
          id: input.id,
          found: Boolean(entry),
        },
        "get-knowledge executed"
      )

      const message = formatSuccessMessage(entry, input.id)

      const payload: GetKnowledgeToolOutput = {
        entry: entry ?? null,
      }

      return createSuccessResult(payload, message)
    } catch (error) {
      const toolError = toToolError(error)
      logger.error(
        {
          scope: "get-knowledge",
          id: input.id,
          err: error,
        },
        "get-knowledge failed"
      )
      return createErrorResult(toolError)
    }
  }
