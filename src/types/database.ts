/**
 * Database Types
 *
 * Types and interfaces for database operations in Beacon MCP.
 */

import type { Logger } from "pino";
import type {
  KnowledgeEntry,
  StoreKnowledgeInput,
  UpdateKnowledgeInput,
} from "./knowledge.js";
import type {
  PathSearchQuery,
  PathSearchResults,
  SearchQuery,
  SearchResults,
} from "./search.js";

/**
 * Database configuration interface
 *
 * Configuration for DuckDB database connection.
 */
export type DatabaseConfig = {
  /** Database file path */
  location: string;
  /** Logger instance */
  logger: Logger;
};

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
  storeKnowledge(entry: StoreKnowledgeInput): Promise<KnowledgeEntry>;

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
  ): Promise<KnowledgeEntry>;

  /**
   * Delete a knowledge entry by ID
   *
   * @param id - ID of the entry to delete
   */
  deleteKnowledge(id: string): Promise<void>;

  /**
   * Get a knowledge entry by ID
   *
   * @param id - ID of the entry to retrieve
   * @returns Knowledge entry or null if not found
   */
  getKnowledge(id: string): Promise<KnowledgeEntry | null>;

  /**
   * Search knowledge entries by path
   *
   * @param query - Path search criteria
   * @returns Matching knowledge entries
   */
  searchByPath(query: PathSearchQuery): Promise<PathSearchResults>;

  /**
   * Search knowledge entries by content
   *
   * @param query - Content search criteria
   * @returns Search results with relevance scoring
   */
  searchByContent(query: SearchQuery): Promise<SearchResults>;

  /**
   * Close database connection and cleanup resources
   */
  dispose(): Promise<void>;
};
