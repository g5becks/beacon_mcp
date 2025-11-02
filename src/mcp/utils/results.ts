import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { BeaconError } from "../../types/errors.js"
import type { ToolError } from "../../types/mcp-tools.js"

type ToolErrorPayload = ToolError["error"]

export const createSuccessResult = <T extends Record<string, unknown>>(
  structuredContent: T,
  message: string
): CallToolResult => ({
  content: [
    {
      type: "text",
      text: message,
    },
  ],
  structuredContent,
})

export const createErrorResult = (
  error: ToolErrorPayload,
  messageOverride?: string
): CallToolResult => ({
  isError: true,
  content: [
    {
      type: "text",
      text: messageOverride ?? `${error.code}: ${error.message}`,
    },
  ],
  structuredContent: {
    success: false,
    error,
  },
})

export const toToolError = (
  error: unknown,
  fallback?: Partial<ToolErrorPayload>
): ToolErrorPayload => {
  if (error instanceof BeaconError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    }
  }

  if (error instanceof Error) {
    return {
      code: fallback?.code ?? "INTERNAL_ERROR",
      message:
        fallback?.message ??
        (error.message && error.message.length > 0
          ? error.message
          : "Internal error"),
      details:
        fallback?.details ??
        ({
          name: error.name,
        } satisfies Record<string, unknown>),
    }
  }

  return {
    code: fallback?.code ?? "INTERNAL_ERROR",
    message:
      fallback?.message ??
      "An unknown error occurred while processing the request",
    details: fallback?.details,
  }
}
