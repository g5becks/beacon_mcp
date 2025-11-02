import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import type { ZodType } from "zod"
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "../types/constants.js"
import type { Database } from "../types/database.js"
import type { Logger } from "../types/logger.js"
import {
  type GetKnowledgeToolInput,
  GetKnowledgeToolInputSchema,
  type ListKnowledgeToolInput,
  ListKnowledgeToolInputSchema,
  type SearchKnowledgeToolInput,
  SearchKnowledgeToolInputSchema,
  type StoreKnowledgeToolInput,
  StoreKnowledgeToolInputSchema,
  TOOL_DEFINITIONS,
} from "../types/mcp-tools.js"
import type { QueryEngine } from "../types/query-engine.js"
import { createSearchKnowledgeHandler } from "./handlers/search-knowledge.js"
import { createStoreKnowledgeHandler } from "./handlers/store-knowledge.js"
import { createErrorResult, toToolError } from "./utils/results.js"

type ValidationErrorDetail = {
  path: string
  message: string
}

type McpToolHandler<Input> = (input: Input) => Promise<CallToolResult>

export type McpToolHandlers = {
  storeKnowledge: McpToolHandler<StoreKnowledgeToolInput>
  searchKnowledge: McpToolHandler<SearchKnowledgeToolInput>
  getKnowledge: McpToolHandler<GetKnowledgeToolInput>
  listKnowledge: McpToolHandler<ListKnowledgeToolInput>
}

export type CreateMcpServerOptions = {
  logger: Logger
  database: Database
  queryEngine: QueryEngine
  handlers?: Partial<McpToolHandlers>
}

export type McpServer = {
  start(): Promise<void>
  stop(): Promise<void>
  isRunning(): boolean
  getServer(): Server
}

const TOOL_ORDER = ["store", "search", "get", "list"] as const

const validationErrorResult = (
  toolName: string,
  issues: ValidationErrorDetail[]
): CallToolResult => {
  const lines = issues
    .map((issue) => `- ${issue.path}: ${issue.message}`)
    .join("\n")

  return createErrorResult(
    {
      code: "INVALID_INPUT",
      message: `Validation failed for ${toolName}`,
      details: { issues },
    },
    `Validation failed for ${toolName} input:\n${lines}`
  )
}

const exceptionResult = (toolName: string, error: unknown): CallToolResult => {
  const toolError = toToolError(error, {
    code: "INTERNAL_ERROR",
    message: `Tool ${toolName} failed`,
    details: { tool: toolName },
  })
  return createErrorResult(toolError)
}

const missingToolResult = (toolName: string): CallToolResult =>
  createErrorResult({
    code: "INVALID_INPUT",
    message: `Unknown tool requested: ${toolName}`,
    details: { tool: toolName },
  })

const notImplementedHandler =
  <Input>(toolName: string): McpToolHandler<Input> =>
  async () =>
    createErrorResult({
      code: "INVALID_INPUT",
      message: `${toolName} handler not implemented`,
      details: { tool: toolName },
    })

type ToolInvocation<Input> = {
  name: string
  schema: ZodType<Input>
  handler: McpToolHandler<Input>
}

const handleToolCall = async <Input>(
  invocation: ToolInvocation<Input>,
  rawArgs: unknown,
  logger: Logger
): Promise<CallToolResult> => {
  const parsed = invocation.schema.safeParse(rawArgs ?? {})
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }))
    logger.warn(
      { tool: invocation.name, issues, scope: "mcp-server" },
      `${invocation.name} validation failed`
    )
    return validationErrorResult(invocation.name, issues)
  }

  try {
    return await invocation.handler(parsed.data)
  } catch (error) {
    logger.error(
      { err: error, tool: invocation.name, scope: "mcp-server" },
      `${invocation.name} handler failed`
    )
    return exceptionResult(invocation.name, error)
  }
}

const buildHandlers = (options: CreateMcpServerOptions): McpToolHandlers => {
  const { database, queryEngine, logger, handlers } = options

  const storeHandler =
    handlers?.storeKnowledge ??
    createStoreKnowledgeHandler({ database, logger })

  const searchHandler =
    handlers?.searchKnowledge ??
    createSearchKnowledgeHandler({ queryEngine, logger })

  const getHandler =
    handlers?.getKnowledge ?? notImplementedHandler(TOOL_DEFINITIONS.get.name)

  const listHandler =
    handlers?.listKnowledge ?? notImplementedHandler(TOOL_DEFINITIONS.list.name)

  return {
    storeKnowledge: storeHandler,
    searchKnowledge: searchHandler,
    getKnowledge: getHandler,
    listKnowledge: listHandler,
  }
}

export const createMcpServer = (options: CreateMcpServerOptions): McpServer => {
  const { logger } = options
  const handlers = buildHandlers(options)

  const server = new Server(
    {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
    }
  )

  const transport = new StdioServerTransport()

  let running = false

  transport.onclose = () => {
    running = false
    logger.info({ scope: "mcp-server" }, "Transport connection closed")
  }

  transport.onerror = (error: Error) => {
    logger.error({ err: error, scope: "mcp-server" }, "Transport error")
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_ORDER.map((key) => TOOL_DEFINITIONS[key]).map((tool) => ({
      name: tool.name,
      title: tool.annotations.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, (request) => {
    const { name, arguments: args = {} } = request.params

    switch (name) {
      case TOOL_DEFINITIONS.store.name:
        return handleToolCall(
          {
            name,
            schema: StoreKnowledgeToolInputSchema,
            handler: handlers.storeKnowledge,
          },
          args,
          logger
        )

      case TOOL_DEFINITIONS.search.name:
        return handleToolCall(
          {
            name,
            schema: SearchKnowledgeToolInputSchema,
            handler: handlers.searchKnowledge,
          },
          args,
          logger
        )

      case TOOL_DEFINITIONS.get.name:
        return handleToolCall(
          {
            name,
            schema: GetKnowledgeToolInputSchema,
            handler: handlers.getKnowledge,
          },
          args,
          logger
        )

      case TOOL_DEFINITIONS.list.name:
        return handleToolCall(
          {
            name,
            schema: ListKnowledgeToolInputSchema,
            handler: handlers.listKnowledge,
          },
          args,
          logger
        )

      default:
        logger.warn({ tool: name, scope: "mcp-server" }, "unknown tool")
        return missingToolResult(name)
    }
  })

  const start = async (): Promise<void> => {
    if (running) {
      logger.warn({ scope: "mcp-server" }, "MCP server already running")
      return
    }

    await server.connect(transport)
    running = true
    logger.info({ scope: "mcp-server" }, "MCP server started")
  }

  const stop = async (): Promise<void> => {
    if (!running) {
      return
    }

    await server.close()
    running = false
    logger.info({ scope: "mcp-server" }, "MCP server stopped")
  }

  return {
    start,
    stop,
    isRunning: () => running,
    getServer: () => server,
  }
}
