import { z } from "zod"
import {
  KnowledgeEntrySchema,
  KnowledgeTypeSchema,
  StoreKnowledgeInputSchema,
} from "./knowledge.js"
import { SearchQuerySchema, SearchResultsSchema } from "./search.js"

const ToolErrorDetailsSchema = z.record(z.string(), z.unknown()).optional()

export const ToolErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string().min(1, "Error code cannot be empty"),
    message: z.string().min(1, "Error message cannot be empty"),
    details: ToolErrorDetailsSchema,
  }),
})

export const StoreKnowledgeSuccessSchema = z.object({
  success: z.literal(true),
  entry: KnowledgeEntrySchema,
  message: z.string().min(1, "Success message cannot be empty").optional(),
})

export const StoreKnowledgeToolInputSchema = StoreKnowledgeInputSchema
export const StoreKnowledgeToolOutputSchema = z.union([
  StoreKnowledgeSuccessSchema,
  ToolErrorSchema,
])

export const SearchKnowledgeToolInputSchema = SearchQuerySchema
export const SearchKnowledgeToolOutputSchema = z.union([
  SearchResultsSchema,
  ToolErrorSchema,
])

export const GetKnowledgeToolInputSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
})

export const GetKnowledgeToolOutputSchema = z.object({
  entry: KnowledgeEntrySchema.nullable(),
})

export const ListKnowledgeToolInputSchema = z.object({
  type: KnowledgeTypeSchema.optional(),
})

export const ListKnowledgeToolOutputSchema = z.object({
  entries: z.array(KnowledgeEntrySchema),
})

export type StoreKnowledgeToolInput = z.infer<
  typeof StoreKnowledgeToolInputSchema
>
export type StoreKnowledgeToolOutput = z.infer<
  typeof StoreKnowledgeToolOutputSchema
>
export type ToolError = z.infer<typeof ToolErrorSchema>
export type StoreKnowledgeSuccess = z.infer<typeof StoreKnowledgeSuccessSchema>

export type SearchKnowledgeToolInput = z.infer<
  typeof SearchKnowledgeToolInputSchema
>
export type SearchKnowledgeToolOutput = z.infer<
  typeof SearchKnowledgeToolOutputSchema
>

export type GetKnowledgeToolInput = z.infer<typeof GetKnowledgeToolInputSchema>
export type GetKnowledgeToolOutput = z.infer<
  typeof GetKnowledgeToolOutputSchema
>

export type ListKnowledgeToolInput = z.infer<
  typeof ListKnowledgeToolInputSchema
>
export type ListKnowledgeToolOutput = z.infer<
  typeof ListKnowledgeToolOutputSchema
>

const jsonSchemaTarget = { target: "draft-2020-12" } as const

export const StoreKnowledgeToolJsonSchema = {
  input: z.toJSONSchema(StoreKnowledgeToolInputSchema, jsonSchemaTarget),
  output: z.toJSONSchema(StoreKnowledgeToolOutputSchema, jsonSchemaTarget),
}

export const SearchKnowledgeToolJsonSchema = {
  input: z.toJSONSchema(SearchKnowledgeToolInputSchema, jsonSchemaTarget),
  output: z.toJSONSchema(SearchKnowledgeToolOutputSchema, jsonSchemaTarget),
}

export const GetKnowledgeToolJsonSchema = {
  input: z.toJSONSchema(GetKnowledgeToolInputSchema, jsonSchemaTarget),
  output: z.toJSONSchema(GetKnowledgeToolOutputSchema, jsonSchemaTarget),
}

export const ListKnowledgeToolJsonSchema = {
  input: z.toJSONSchema(ListKnowledgeToolInputSchema, jsonSchemaTarget),
  output: z.toJSONSchema(ListKnowledgeToolOutputSchema, jsonSchemaTarget),
}

export const TOOL_DEFINITIONS = {
  store: {
    name: "store-knowledge",
    description:
      "Store a knowledge entry including path, type, title, content, and optional metadata.",
    annotations: {
      title: "Store Knowledge",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: StoreKnowledgeToolJsonSchema.input,
    outputSchema: StoreKnowledgeToolJsonSchema.output,
  },
  search: {
    name: "search-knowledge",
    description:
      "Search knowledge entries by path hierarchy, glob patterns, or full-text content.",
    annotations: {
      title: "Search Knowledge",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: SearchKnowledgeToolJsonSchema.input,
    outputSchema: SearchKnowledgeToolJsonSchema.output,
  },
  get: {
    name: "get-knowledge",
    description: "Retrieve a single knowledge entry by its identifier.",
    annotations: {
      title: "Get Knowledge",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: GetKnowledgeToolJsonSchema.input,
    outputSchema: GetKnowledgeToolJsonSchema.output,
  },
  list: {
    name: "list-knowledge",
    description: "List knowledge entries, optionally filtered by type.",
    annotations: {
      title: "List Knowledge",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: ListKnowledgeToolJsonSchema.input,
    outputSchema: ListKnowledgeToolJsonSchema.output,
  },
} as const
