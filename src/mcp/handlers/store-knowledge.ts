import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { Database } from "../../types/database.js"
import { ValidationError } from "../../types/errors.js"
import type { Logger } from "../../types/logger.js"
import type {
  StoreKnowledgeSuccess,
  StoreKnowledgeToolInput,
} from "../../types/mcp-tools.js"
import {
  createErrorResult,
  createSuccessResult,
  toToolError,
} from "../utils/results.js"

export type StoreKnowledgeHandlerDependencies = {
  database: Database
  logger: Logger
}

const normalizeDetailsMetadata = (
  input: StoreKnowledgeToolInput
): Record<string, unknown> | undefined => {
  if (input.type !== "details") {
    return input.metadata
  }

  const metadata = input.metadata ?? {}
  const rawLibrary = metadata.library
  const library = typeof rawLibrary === "string" ? rawLibrary.trim() : ""

  if (!library) {
    throw new ValidationError(
      "metadata.library is required for details knowledge entries",
      {
        path: input.path,
        type: input.type,
      }
    )
  }

  return {
    ...metadata,
    library,
  }
}

const buildSuccessPayload = (
  entry: StoreKnowledgeSuccess["entry"],
  message: string
): StoreKnowledgeSuccess => ({
  success: true,
  entry,
  message,
})

export const createStoreKnowledgeHandler =
  ({
    database,
    logger,
  }: StoreKnowledgeHandlerDependencies): ((
    input: StoreKnowledgeToolInput
  ) => Promise<CallToolResult>) =>
  async (input) => {
    const context = {
      path: input.path,
      type: input.type,
    }

    let normalizedMetadata: Record<string, unknown> | undefined

    try {
      normalizedMetadata = normalizeDetailsMetadata(input)
    } catch (error) {
      const toolError = toToolError(error)
      logger.warn(
        { ...context, error: toolError },
        "store-knowledge validation failed"
      )
      return createErrorResult(toolError)
    }

    try {
      const entry = await database.storeKnowledge({
        ...input,
        metadata: normalizedMetadata,
      })

      const message = `Knowledge entry stored with ID ${entry.id}`

      logger.info({ ...context, id: entry.id }, "store-knowledge succeeded")

      return createSuccessResult(buildSuccessPayload(entry, message), message)
    } catch (error) {
      const toolError = toToolError(error)
      logger.error({ ...context, err: error }, "store-knowledge failed")
      return createErrorResult(toolError)
    }
  }
