/**
 * Database Types
 *
 * Types and interfaces for database operations in Beacon MCP.
 */

import type { Logger } from "pino"
import type { Environment } from "./config.js"
import type {
  KnowledgeEntry,
  KnowledgeType,
  StoreKnowledgeInput,
  UpdateKnowledgeInput,
} from "./knowledge.js"
import type {
  PathSearchQuery,
  PathSearchResults,
  SearchQuery,
  SearchResults,
} from "./search.js"

/**
 * Database configuration interface
 *
 * Configuration for DuckDB database connection.
 */
export type DatabaseConfig = {
  /** Database file path */
  location: string
  /** Logger instance */
  logger: Logger
  /** Application environment */
  environment: Environment
}

/**
 * Search filter options
 */
export type SearchFilters = {
  /** Filter results by knowledge type */
  type?: KnowledgeType
  /** Restrict results to a specific path */
  path?: string
  /** Glob pattern filter */
  pattern?: string
  /** Include ancestor paths in results */
  includeAncestors?: boolean
}

/**
 * Search options returning from full-text search queries.
 */
export type SearchOptions = {
  /** Maximum number of results to return */
  limit?: number
  /** Number of results to skip */
  offset?: number
  /** Minimum relevance score threshold */
  minScore?: number
  /** Include content snippets in the response */
  includeSnippets?: boolean
  /** Length of content snippets when included */
  snippetLength?: number
  /** Highlight matching terms within snippets */
  highlightMatches?: boolean
  /** Additional filters applied to the search */
  filters?: SearchFilters
}

/**
 * Search result metadata for content-based queries.
 */
export type SearchResult = {
  /** Matching knowledge entry */
  entry: KnowledgeEntry
  /** Relevance score between 0 and 1 */
  score: number
  /** Fields that contributed to the match */
  matchedFields: Array<"path" | "title" | "content" | "metadata">
  /** Matched terms returned by the search engine */
  matchedTerms?: string[]
  /** Content snippets surrounding matches */
  snippets?: string[]
  /** Human-readable explanation for the match */
  matchExplanation?: string
}

/**
 * Database interface
 *
 * Core database operations for knowledge management.
 * Write operations should use file locking for concurrent access safety.
 * Read operations are concurrent-safe in DuckDB.
 */
export type Database = {
  /**
   * Store a new knowledge entry
   *
   * @param entry - Knowledge entry to store
   * @returns Stored knowledge entry with generated ID and timestamps
   */
  storeKnowledge(entry: StoreKnowledgeInput): Promise<KnowledgeEntry>

  /**
   * Update an existing knowledge entry
   *
   * @param id - ID of the entry to update
   * @param updates - Fields to update
   * @returns Updated knowledge entry
   */
  updateKnowledge(
    id: string,
    updates: UpdateKnowledgeInput
  ): Promise<KnowledgeEntry>

  /**
   * Delete a knowledge entry by ID
   *
   * @param id - ID of the entry to delete
   */
  deleteKnowledge(id: string): Promise<void>

  /**
   * Get a knowledge entry by ID
   *
   * @param id - ID of the entry to retrieve
   * @returns Knowledge entry or null if not found
   */
  getKnowledge(id: string): Promise<KnowledgeEntry | null>

  /**
   * Search knowledge entries by path
   *
   * @param query - Path search criteria
   * @returns Matching knowledge entries
   */
  searchByPath(query: PathSearchQuery): Promise<PathSearchResults>

  /**
   * Search knowledge entries by content
   *
   * @param query - Content search criteria
   * @returns Search results with relevance scoring
   */
  searchByContent(
    query: SearchQuery,
    options?: SearchOptions
  ): Promise<SearchResults>

  /**
   * List knowledge entries optionally filtered by type
   */
  listKnowledge(type?: KnowledgeType): Promise<KnowledgeEntry[]>

  /**
   * Close database connection and cleanup resources
   */
  dispose(): Promise<void>
}
