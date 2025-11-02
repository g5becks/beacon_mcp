/**
 * Search and Query Types
 *
 * Types and schemas for searching knowledge entries, glob pattern matching,
 * and query operations in Beacon MCP.
 */

import { z } from "zod"
import {
  DEFAULT_QUERY_TIMEOUT_MS,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
  DEFAULT_SNIPPET_LENGTH,
  DIRECTORY_TRAVERSAL_SEQUENCE,
  MAX_ANCESTORS_DEPTH,
  MAX_SEARCH_LIMIT,
  MAX_SNIPPET_LENGTH,
  MIN_SNIPPET_LENGTH,
} from "./constants.js"
import {
  KnowledgeEntrySchema,
  KnowledgePathSchema,
  KnowledgeTypeSchema,
} from "./knowledge.js"

const includesDirectoryTraversal = (value: string): boolean =>
  value.includes(DIRECTORY_TRAVERSAL_SEQUENCE)

// ============================================================================
// Search Query Types
// ============================================================================

/**
 * Search query schema
 *
 * Defines the parameters for searching knowledge entries.
 * All fields are optional - at least one should be provided.
 */
export const SearchQuerySchema = z
  .object(
    {
      /**
       * Exact path match
       * Finds entries at the specific path
       */
      path: KnowledgePathSchema.optional(),

      /**
       * Glob pattern for path matching
       * Supports wildcards: *, **, [a-z], etc.
       */
      pattern: z
        .string()
        .min(1, "Pattern cannot be empty")
        .optional()
        .refine((pattern) => {
          if (!pattern) {
            return true
          }
          // Basic pattern validation - more complex validation happens during matching
          return !includesDirectoryTraversal(pattern)
        }, "Pattern cannot contain directory traversal"),

      /**
       * Full-text search in content
       * Searches within title and content fields
       */
      content: z.string().min(1, "Content query cannot be empty").optional(),

      /**
       * Filter by knowledge type
       */
      type: KnowledgeTypeSchema.optional(),

      /**
       * Maximum number of results to return
       */
      limit: z
        .number()
        .int()
        .positive("Limit must be a positive integer")
        .max(MAX_SEARCH_LIMIT, `Limit cannot exceed ${MAX_SEARCH_LIMIT}`)
        .default(DEFAULT_SEARCH_LIMIT),

      /**
       * Number of results to skip (for pagination)
       */
      offset: z
        .number()
        .int()
        .min(0, "Offset cannot be negative")
        .default(DEFAULT_SEARCH_OFFSET),

      /**
       * Sort order for results
       */
      sortBy: z
        .enum(["path", "title", "createdAt", "updatedAt", "relevance"])
        .default("relevance"),

      /**
       * Sort direction
       */
      sortOrder: z.enum(["asc", "desc"]).default("desc"),

      /**
       * Include ancestors in search results
       * When true, also searches parent paths
       */
      includeAncestors: z.boolean().default(false),

      /**
       * Minimum relevance score (0-1)
       * Only results with score >= threshold are returned
       */
      minScore: z.number().min(0).max(1).default(0),
    },
    {
      error: "Search query must contain at least one search criteria",
    }
  )
  .refine(
    (query) => query.path || query.pattern || query.content,
    "At least one search criteria (path, pattern, or content) must be provided"
  )
export type SearchQuery = z.infer<typeof SearchQuerySchema>

/**
 * Path-only search query
 *
 * Specialized search for path-based queries without content search.
 */
export const PathSearchQuerySchema = z
  .object(
    {
      /**
       * Exact path match
       */
      path: KnowledgePathSchema.optional(),

      /**
       * Glob pattern for path matching
       */
      pattern: z
        .string()
        .min(1, "Pattern cannot be empty")
        .optional()
        .refine((pattern) => {
          if (!pattern) {
            return true
          }
          return !includesDirectoryTraversal(pattern)
        }, "Pattern cannot contain directory traversal"),

      /**
       * Filter by knowledge type
       */
      type: KnowledgeTypeSchema.optional(),

      /**
       * Maximum number of results to return
       */
      limit: z
        .number()
        .int()
        .positive("Limit must be a positive integer")
        .max(MAX_SEARCH_LIMIT, `Limit cannot exceed ${MAX_SEARCH_LIMIT}`)
        .default(DEFAULT_SEARCH_LIMIT),

      /**
       * Number of results to skip (for pagination)
       */
      offset: z
        .number()
        .int()
        .min(0, "Offset cannot be negative")
        .default(DEFAULT_SEARCH_OFFSET),

      /**
       * Sort order for results
       */
      sortBy: z
        .enum(["path", "title", "createdAt", "updatedAt"])
        .default("path"),

      /**
       * Sort direction
       */
      sortOrder: z.enum(["asc", "desc"]).default("asc"),

      /**
       * Include ancestors in search results
       */
      includeAncestors: z.boolean().default(false),
    },
    {
      error: "Path search query must contain path or pattern",
    }
  )
  .refine(
    (query) => query.path || query.pattern,
    "At least one search criteria (path or pattern) must be provided"
  )
export type PathSearchQuery = z.infer<typeof PathSearchQuerySchema>

/**
 * Content search query schema
 *
 * Specialized search for full-text content search.
 */
export const ContentSearchQuerySchema = z.object(
  {
    /**
     * Full-text search query
     */
    query: z.string().min(1, "Search query cannot be empty"),

    /**
     * Filter by knowledge type
     */
    type: KnowledgeTypeSchema.optional(),

    /**
     * Maximum number of results to return
     */
    limit: z
      .number()
      .int()
      .positive("Limit must be a positive integer")
      .max(MAX_SEARCH_LIMIT, `Limit cannot exceed ${MAX_SEARCH_LIMIT}`)
      .default(DEFAULT_SEARCH_LIMIT),

    /**
     * Number of results to skip (for pagination)
     */
    offset: z
      .number()
      .int()
      .min(0, "Offset cannot be negative")
      .default(DEFAULT_SEARCH_OFFSET),

    /**
     * Include content snippets in results
     */
    includeSnippets: z.boolean().default(true),

    /**
     * Length of content snippets
     */
    snippetLength: z
      .number()
      .int()
      .min(MIN_SNIPPET_LENGTH)
      .max(MAX_SNIPPET_LENGTH)
      .default(DEFAULT_SNIPPET_LENGTH),

    /**
     * Highlight matching terms in snippets
     */
    highlightMatches: z.boolean().default(true),
  },
  {
    error: "Content search query must contain a search query",
  }
)
export type ContentSearchQuery = z.infer<typeof ContentSearchQuerySchema>

// ============================================================================
// Search Result Types
// ============================================================================

/**
 * Search result entry
 *
 * Individual search result with metadata about the match.
 */
export const SearchResultSchema = z.object({
  /**
   * The knowledge entry that matched
   */
  entry: KnowledgeEntrySchema,

  /**
   * Relevance score (0-1, higher is more relevant)
   */
  score: z.number().min(0).max(1),

  /**
   * Matched content snippets (if available)
   */
  snippets: z.array(z.string()).optional(),

  /**
   * Highlighted matching terms
   */
  matchedTerms: z.array(z.string()).optional(),

  /**
   * Which fields matched the search
   */
  matchedFields: z.array(z.enum(["path", "title", "content", "metadata"])),

  /**
   * Explanation of why this result matched
   */
  matchExplanation: z.string().optional(),
})
export type SearchResult = z.infer<typeof SearchResultSchema>

/**
 * Search results schema
 *
 * Complete search results with pagination metadata.
 */
export const SearchResultsSchema = z.object({
  /**
   * Array of search results
   */
  results: z.array(SearchResultSchema),

  /**
   * Total number of matching entries (not limited by pagination)
   */
  total: z.number().int().min(0),

  /**
   * Current page offset
   */
  offset: z.number().int().min(0),

  /**
   * Current page limit
   */
  limit: z.number().int().positive(),

  /**
   * Whether there are more results available
   */
  hasMore: z.boolean(),

  /**
   * Search execution time in milliseconds
   */
  executionTime: z.number().min(0),

  /**
   * Search query that produced these results
   */
  query: SearchQuerySchema,
})
export type SearchResults = z.infer<typeof SearchResultsSchema>

/**
 * Path search results schema
 *
 * Results from path-based searches (simplified structure).
 */
export const PathSearchResultsSchema = z.object({
  /**
   * Array of knowledge entries matching the path criteria
   */
  entries: z.array(KnowledgeEntrySchema),

  /**
   * Total number of matching entries
   */
  total: z.number().int().min(0),

  /**
   * Current page offset
   */
  offset: z.number().int().min(0),

  /**
   * Current page limit
   */
  limit: z.number().int().positive(),

  /**
   * Whether there are more results available
   */
  hasMore: z.boolean(),

  /**
   * Pattern that was matched (if applicable)
   */
  matchedPattern: z.string().optional(),
})
export type PathSearchResults = z.infer<typeof PathSearchResultsSchema>

// ============================================================================
// Glob Pattern Types
// ============================================================================

/**
 * Glob pattern schema
 *
 * Unix-style glob patterns for path matching.
 */
export const GlobPatternSchema = z
  .string()
  .min(1, "Glob pattern cannot be empty")
  .refine(
    (pattern) => !includesDirectoryTraversal(pattern),
    "Glob pattern cannot contain directory traversal"
  )
export type GlobPattern = z.infer<typeof GlobPatternSchema>

/**
 * Glob pattern match result
 *
 * Result of matching a glob pattern against paths.
 */
export const GlobMatchSchema = z.object({
  /**
   * The path that matched the pattern
   */
  path: z.string(),

  /**
   * The glob pattern that was matched
   */
  pattern: GlobPatternSchema,

  /**
   * Which parts of the pattern matched which path segments
   */
  matchedSegments: z.array(z.string()),

  /**
   * Confidence score for the match (0-1)
   * Higher means more specific match
   */
  confidence: z.number().min(0).max(1),

  /**
   * Whether this is an exact match
   */
  isExact: z.boolean(),
})
export type GlobMatch = z.infer<typeof GlobMatchSchema>

/**
 * Glob pattern compilation options
 */
export const GlobOptionsSchema = z.object({
  /**
   * Case-sensitive matching
   */
  caseSensitive: z.boolean().default(true),

  /**
   * Match hidden files/directories (starting with .)
   */
  includeHidden: z.boolean().default(false),

  /**
   * Follow symbolic links
   */
  followSymlinks: z.boolean().default(false),

  /**
   * Maximum depth for recursive matching (**)
   */
  maxDepth: z.number().int().positive().default(MAX_ANCESTORS_DEPTH),
})
export type GlobOptions = z.infer<typeof GlobOptionsSchema>

// ============================================================================
// Query Builder Types
// ============================================================================

/**
 * SQL query builder configuration
 *
 * Configuration for building SQL queries from search criteria.
 */
export const QueryBuilderConfigSchema = z.object({
  /**
   * Table name for knowledge entries
   */
  tableName: z.string().default("knowledge"),

  /**
   * Whether to use full-text search
   */
  useFullTextSearch: z.boolean().default(true),

  /**
   * Whether to include metadata in SELECT clause
   */
  includeMetadata: z.boolean().default(false),

  /**
   * Whether to include calculated ancestors
   */
  includeAncestors: z.boolean().default(false),

  /**
   * Custom WHERE conditions
   */
  customConditions: z.array(z.string()).default([]),

  /**
   * Custom ORDER BY clauses
   */
  customOrder: z.array(z.string()).default([]),

  /**
   * Query timeout in milliseconds
   */
  timeout: z.number().int().positive().default(DEFAULT_QUERY_TIMEOUT_MS),
})
export type QueryBuilderConfig = z.infer<typeof QueryBuilderConfigSchema>

/**
 * Built SQL query with parameters
 *
 * Represents a complete SQL query ready for execution.
 */
export const BuiltQuerySchema = z.object({
  /**
   * The SQL query string
   */
  sql: z.string(),

  /**
   * Query parameters (for prepared statements)
   */
  parameters: z.array(z.unknown()),

  /**
   * Query type (SELECT, INSERT, UPDATE, DELETE)
   */
  type: z.enum(["SELECT", "INSERT", "UPDATE", "DELETE"]),

  /**
   * Estimated query complexity
   */
  complexity: z.enum(["simple", "moderate", "complex"]),

  /**
   * Whether the query uses full-text search
   */
  usesFullTextSearch: z.boolean(),
})
export type BuiltQuery = z.infer<typeof BuiltQuerySchema>

// ============================================================================
// Search Statistics Types
// ============================================================================

/**
 * Search performance statistics
 *
 * Metrics about search operation performance.
 */
export const SearchStatsSchema = z.object({
  /**
   * Total time for search operation in milliseconds
   */
  totalTime: z.number().min(0),

  /**
   * Time spent querying the database
   */
  queryTime: z.number().min(0),

  /**
   * Time spent processing results
   */
  processingTime: z.number().min(0),

  /**
   * Number of entries examined
   */
  entriesExamined: z.number().int().min(0),

  /**
   * Number of entries returned
   */
  entriesReturned: z.number().int().min(0),

  /**
   * Cache hit rate (0-1)
   */
  cacheHitRate: z.number().min(0).max(1),

  /**
   * Memory usage in bytes
   */
  memoryUsage: z.number().int().min(0),
})
export type SearchStats = z.infer<typeof SearchStatsSchema>
