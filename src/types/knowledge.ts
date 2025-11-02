/**
 * Knowledge Management Types
 *
 * Types and schemas for knowledge entries, search operations, and
 * path-based knowledge organization in Beacon MCP.
 */

import { z } from "zod"
import {
  KNOWLEDGE_TYPES,
  MAX_ANCESTORS_DEPTH,
  MAX_CONTENT_LENGTH,
  MAX_METADATA_ENTRIES,
  MAX_METADATA_KEY_LENGTH,
  MAX_METADATA_VALUE_LENGTH,
  MAX_PATH_LENGTH,
  MAX_PATH_SEGMENT_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_STRING_LENGTH,
  PATH_SEPARATOR,
} from "./constants.js"

// ============================================================================
// Knowledge Entry Types
// ============================================================================

/**
 * Knowledge entry type enum
 *
 * Represents the different types of knowledge that can be stored:
 * - rule: Rules, guidelines, or best practices
 * - decision: Architectural decisions or choices made
 * - details: Implementation notes, project-specific documentation, or references
 */
export const KnowledgeTypeSchema = z.enum(KNOWLEDGE_TYPES, {
  error: "Knowledge type must be one of: rule, decision, or details",
})
export type KnowledgeType = z.infer<typeof KnowledgeTypeSchema>

/**
 * Knowledge entry path schema
 *
 * Paths follow a hierarchical structure using forward slashes:
 * - Always start with forward slash (/)
 * - Use forward slash as separator on all platforms
 * - Path segments contain alphanumeric characters, hyphens, and underscores
 * - Examples: "/api/auth", "/database/decisions/2024", "/frontend/components"
 */
export const KnowledgePathSchema = z
  .string()
  .min(1, "Path cannot be empty")
  .max(MAX_PATH_LENGTH, `Path cannot exceed ${MAX_PATH_LENGTH} characters`)
  .regex(/^\//, "Path must start with forward slash (/)")
  .regex(
    new RegExp(
      `^[${PATH_SEPARATOR}][a-zA-Z0-9_-]+(${PATH_SEPARATOR}[a-zA-Z0-9_-]+)*$`
    ),
    "Path must contain only alphanumeric characters, hyphens, underscores, and forward slashes"
  )
  .refine((path) => {
    const segments = path.split(PATH_SEPARATOR).filter(Boolean)
    return segments.every(
      (segment) => segment.length <= MAX_PATH_SEGMENT_LENGTH
    )
  }, `Each path segment cannot exceed ${MAX_PATH_SEGMENT_LENGTH} characters`)
export type KnowledgePath = z.infer<typeof KnowledgePathSchema>

/**
 * Knowledge entry title schema
 *
 * Human-readable title for the knowledge entry.
 */
export const KnowledgeTitleSchema = z
  .string()
  .min(MIN_STRING_LENGTH, "Title cannot be empty")
  .max(MAX_TITLE_LENGTH, `Title cannot exceed ${MAX_TITLE_LENGTH} characters`)
  .trim()
export type KnowledgeTitle = z.infer<typeof KnowledgeTitleSchema>

/**
 * Knowledge entry content schema
 *
 * The main content of the knowledge entry in markdown format.
 */
export const KnowledgeContentSchema = z
  .string()
  .min(MIN_STRING_LENGTH, "Content cannot be empty")
  .max(
    MAX_CONTENT_LENGTH,
    `Content cannot exceed ${MAX_CONTENT_LENGTH} characters`
  )
export type KnowledgeContent = z.infer<typeof KnowledgeContentSchema>

/**
 * Metadata entry schema
 *
 * Individual key-value pair in knowledge metadata.
 */
export const MetadataEntrySchema = z.tuple([
  z
    .string()
    .min(MIN_STRING_LENGTH, "Metadata key cannot be empty")
    .max(
      MAX_METADATA_KEY_LENGTH,
      `Metadata key cannot exceed ${MAX_METADATA_KEY_LENGTH} characters`
    ),
  z.unknown(),
])
export type MetadataEntry = z.infer<typeof MetadataEntrySchema>

/**
 * Knowledge metadata schema
 *
 * Optional metadata for knowledge entries as key-value pairs.
 * Values can be any JSON-serializable type.
 */
export const KnowledgeMetadataSchema = z
  .record(
    z
      .string()
      .min(MIN_STRING_LENGTH, "Metadata key cannot be empty")
      .max(
        MAX_METADATA_KEY_LENGTH,
        `Metadata key cannot exceed ${MAX_METADATA_KEY_LENGTH} characters`
      ),
    z.unknown(),
    {
      error: "Metadata must be a record of key-value pairs",
    }
  )
  .refine(
    (metadata) => Object.keys(metadata).length <= MAX_METADATA_ENTRIES,
    `Cannot exceed ${MAX_METADATA_ENTRIES} metadata entries`
  )
  .refine(
    (metadata) =>
      Object.entries(metadata).every(([, value]) => {
        const valueStr = JSON.stringify(value)
        return valueStr.length <= MAX_METADATA_VALUE_LENGTH
      }),
    `Metadata values cannot exceed ${MAX_METADATA_VALUE_LENGTH} characters when serialized`
  )
export type KnowledgeMetadata = z.infer<typeof KnowledgeMetadataSchema>

// ============================================================================
// Knowledge Entry Schemas
// ============================================================================

/**
 * Complete knowledge entry schema
 *
 * Represents a fully-validated knowledge entry stored in the system.
 */
export const KnowledgeEntrySchema = z.object(
  {
    /**
     * Unique identifier for the knowledge entry
     * Generated automatically by the database
     */
    id: z.string().uuid("ID must be a valid UUID"),

    /**
     * Hierarchical path for the knowledge entry
     * Used for organization and retrieval
     */
    path: KnowledgePathSchema,

    /**
     * Type of knowledge entry
     */
    type: KnowledgeTypeSchema,

    /**
     * Human-readable title
     */
    title: KnowledgeTitleSchema,

    /**
     * Main content in markdown format
     */
    content: KnowledgeContentSchema,

    /**
     * Optional metadata for additional context
     */
    metadata: KnowledgeMetadataSchema.optional(),

    /**
     * Timestamp when the entry was created (Unix timestamp in milliseconds)
     */
    createdAt: z
      .number()
      .int()
      .positive("Created timestamp must be a positive integer"),

    /**
     * Timestamp when the entry was last updated (Unix timestamp in milliseconds)
     */
    updatedAt: z
      .number()
      .int()
      .positive("Updated timestamp must be a positive integer"),

    /**
     * Calculated ancestor paths for hierarchical queries
     * Automatically generated from the path
     */
    ancestors: z.array(z.string()).optional(),
  },
  {
    error:
      "Knowledge entry must be a valid object with required fields and proper types",
  }
)
export type KnowledgeEntry = z.infer<typeof KnowledgeEntrySchema>

/**
 * Input schema for creating new knowledge entries
 *
 * Used when users want to store new knowledge. ID and timestamps are generated automatically.
 */
export const StoreKnowledgeInputSchema = z.object(
  {
    /**
     * Hierarchical path where the knowledge should be stored
     */
    path: KnowledgePathSchema,

    /**
     * Type of knowledge being stored
     */
    type: KnowledgeTypeSchema,

    /**
     * Human-readable title for the knowledge
     */
    title: KnowledgeTitleSchema,

    /**
     * Main content in markdown format
     */
    content: KnowledgeContentSchema,

    /**
     * Optional metadata for additional context
     */
    metadata: KnowledgeMetadataSchema.optional(),
  },
  {
    error:
      "Store knowledge input must contain valid path, type, title, and content",
  }
)
export type StoreKnowledgeInput = z.infer<typeof StoreKnowledgeInputSchema>

/**
 * Input schema for updating existing knowledge entries
 *
 * All fields are optional - only provided fields will be updated.
 */
export const UpdateKnowledgeInputSchema = z.object(
  {
    /**
     * New path (if moving the entry)
     */
    path: KnowledgePathSchema.optional(),

    /**
     * New type (if changing the entry type)
     */
    type: KnowledgeTypeSchema.optional(),

    /**
     * New title
     */
    title: KnowledgeTitleSchema.optional(),

    /**
     * New content
     */
    content: KnowledgeContentSchema.optional(),

    /**
     * New metadata (will replace existing metadata)
     */
    metadata: KnowledgeMetadataSchema.optional(),
  },
  {
    error: "Update knowledge input must contain valid fields to update",
  }
)
export type UpdateKnowledgeInput = z.infer<typeof UpdateKnowledgeInputSchema>

// ============================================================================
// Path Resolution Types
// ============================================================================

/**
 * Path resolution result
 *
 * Represents the result of resolving a knowledge path into its components.
 */
export const PathResolutionSchema = z.object({
  /**
   * The original path that was resolved
   */
  originalPath: KnowledgePathSchema,

  /**
   * Individual path segments
   */
  segments: z.array(z.string()),

  /**
   * All ancestor paths for hierarchical queries
   */
  ancestors: z.array(z.string()),

  /**
   * Parent path (empty string for root)
   */
  parentPath: z.string(),

  /**
   * Final segment name
   */
  name: z.string(),
})
export type PathResolution = z.infer<typeof PathResolutionSchema>

/**
 * Path ancestor calculation options
 */
export const PathAncestorOptionsSchema = z.object({
  /**
   * Include the root path in ancestors
   */
  includeRoot: z.boolean().default(true),

  /**
   * Maximum depth of ancestors to calculate
   */
  maxDepth: z.number().int().positive().default(MAX_ANCESTORS_DEPTH),

  /**
   * Whether to include the full path in ancestors
   */
  includeSelf: z.boolean().default(false),
})
export type PathAncestorOptions = z.infer<typeof PathAncestorOptionsSchema>

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Knowledge entry without sensitive internal fields
 *
 * Used for API responses to avoid exposing internal implementation details.
 */
export type KnowledgeEntryPublic = Omit<
  KnowledgeEntry,
  // Remove internal fields that shouldn't be exposed in API responses
  "ancestors" // These are calculated and used internally
>

/**
 * Knowledge entry summary for list views
 *
 * Lightweight representation for search results and lists.
 */
export type KnowledgeEntrySummary = Pick<
  KnowledgeEntry,
  "id" | "path" | "type" | "title" | "createdAt" | "updatedAt"
>

/**
 * Path match result
 *
 * Represents a path that matches a given pattern or query.
 */
export type PathMatch = {
  path: string
  confidence: number
  matchedSegments: string[]
}

/**
 * Knowledge statistics
 *
 * Aggregate statistics about the knowledge base.
 */
export type KnowledgeStats = {
  totalEntries: number
  entriesByType: Record<KnowledgeType, number>
  entriesByDepth: Record<number, number>
  lastUpdated: number
  deepestPath: string
}
