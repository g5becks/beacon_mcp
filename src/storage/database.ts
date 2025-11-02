import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { performance } from "node:perf_hooks"
import { type DuckDBConnection, DuckDBInstance } from "@duckdb/node-api"
import type {
  Database,
  DatabaseConfig,
  SearchOptions,
  SearchResult,
} from "../types/database.js"
import {
  DatabaseError,
  KnowledgeNotFoundError,
  ValidationError,
} from "../types/errors.js"
import type {
  KnowledgeEntry,
  KnowledgeType,
  StoreKnowledgeInput,
  UpdateKnowledgeInput,
} from "../types/knowledge.js"
import type { Logger } from "../types/logger.js"
import type {
  PathSearchQuery,
  PathSearchResults,
  SearchQuery,
  SearchResults,
} from "../types/search.js"
import { initializeSchema } from "./migrations.js"

type KnowledgeRow = {
  id: string
  type: string
  path: string
  title: string
  content: string
  metadata: string | null
  created_at: Date
  updated_at: Date
  score?: number
}

const PATH_SEPARATOR = "/"

const DEFAULT_LIMIT = 20
const DEFAULT_OFFSET = 0
const DEFAULT_MIN_SCORE = 0

const require = createRequire(import.meta.url)
type LockfileModule = typeof import("proper-lockfile")
const lockfile = require("proper-lockfile") as LockfileModule

const LOCK_OPTIONS = {
  stale: 10_000,
  retries: 3,
} as const

const toError = (error: unknown): Error | undefined =>
  error instanceof Error ? error : undefined

const buildAncestors = (path: string): string[] => {
  const normalized = path.replace(/\\/g, PATH_SEPARATOR)

  if (normalized === PATH_SEPARATOR) {
    return [PATH_SEPARATOR]
  }

  const segments = normalized
    .split(PATH_SEPARATOR)
    .filter((segment) => segment.length > 0)

  const ancestors: string[] = [PATH_SEPARATOR]
  let current = ""

  for (const segment of segments) {
    current = `${current}${PATH_SEPARATOR}${segment}`
    ancestors.push(current)
  }

  return ancestors
}

const parseMetadata = (
  metadata: string | null
): Record<string, unknown> | undefined => {
  if (!metadata) {
    return
  }
  try {
    return JSON.parse(metadata) as Record<string, unknown>
  } catch (_error) {
    return
  }
}

const toDateValue = (value: unknown): Date => {
  if (value instanceof Date) {
    return value
  }
  if (typeof value === "number") {
    return new Date(value)
  }
  if (typeof value === "string") {
    return new Date(value)
  }
  return new Date(0)
}

const mapRowToKnowledgeEntry = (row: KnowledgeRow): KnowledgeEntry => {
  const createdAtMs = row.created_at.getTime()
  const updatedAtMs = row.updated_at.getTime()

  return {
    id: row.id,
    path: row.path,
    type: row.type as KnowledgeType,
    title: row.title,
    content: row.content,
    metadata: parseMetadata(row.metadata),
    createdAt: createdAtMs,
    updatedAt: updatedAtMs,
    ancestors: buildAncestors(row.path),
  }
}

const toSqlLikePattern = (pattern: string): string => {
  const escaped = pattern.replace(/[%_]/g, (match) => `\\${match}`)
  return escaped.replace(/\*\*/g, "%").replace(/\*/g, "%").replace(/\?/g, "_")
}

const coerceRow = (row: Record<string, unknown>): KnowledgeRow => {
  const metadataValue = row.metadata
  const scoreValue = row.score

  let metadataString: string | null = null
  if (metadataValue !== null && metadataValue !== undefined) {
    metadataString =
      typeof metadataValue === "string"
        ? metadataValue
        : JSON.stringify(metadataValue)
  }

  return {
    id: String(row.id),
    type: String(row.type),
    path: String(row.path),
    title: String(row.title),
    content: String(row.content),
    metadata: metadataString,
    created_at: toDateValue(row.created_at),
    updated_at: toDateValue(row.updated_at),
    score:
      scoreValue === undefined || scoreValue === null
        ? undefined
        : Number(scoreValue),
  }
}

const addTypeCondition = (
  query: PathSearchQuery,
  conditions: string[],
  params: Array<string | number>
): void => {
  if (!query.type) {
    return
  }
  conditions.push("type = ?")
  params.push(query.type)
}

const addPathCondition = (
  query: PathSearchQuery,
  conditions: string[],
  params: Array<string | number>
): void => {
  if (!query.path) {
    return
  }

  const includeAncestors = query.includeAncestors ?? false
  const paths = includeAncestors ? buildAncestors(query.path) : [query.path]

  const placeholders = paths.map(() => "?").join(",")
  conditions.push(`path IN (${placeholders})`)
  for (const path of paths) {
    params.push(path)
  }
}

const addPatternCondition = (
  query: PathSearchQuery,
  conditions: string[],
  params: Array<string | number>
): void => {
  if (!query.pattern) {
    return
  }
  conditions.push("path LIKE ? ESCAPE '\\'")
  params.push(toSqlLikePattern(query.pattern))
}

type PathSearchPreparation = {
  whereSql: string
  params: Array<string | number>
  sortColumn: string
  sortOrder: "ASC" | "DESC"
  limit: number
  offset: number
}

const preparePathSearch = (query: PathSearchQuery): PathSearchPreparation => {
  const limit = query.limit ?? DEFAULT_LIMIT
  const offset = query.offset ?? DEFAULT_OFFSET
  const conditions: string[] = []
  const params: Array<string | number> = []

  addTypeCondition(query, conditions, params)
  addPathCondition(query, conditions, params)
  addPatternCondition(query, conditions, params)

  const whereSql =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const sortColumnMap: Record<string, string> = {
    path: "path",
    title: "title",
    createdAt: "created_at",
    updatedAt: "updated_at",
  }

  const sortColumn = sortColumnMap[query.sortBy ?? "path"] ?? "path"
  const sortOrder = query.sortOrder === "desc" ? "DESC" : "ASC"

  return {
    whereSql,
    params,
    sortColumn,
    sortOrder,
    limit,
    offset,
  }
}

type ClauseResult = {
  clause?: string
  params: Array<string | number>
  matched: boolean
}

const buildTypeClause = (
  queryType?: KnowledgeType,
  optionType?: KnowledgeType
): ClauseResult => {
  const types = new Set<KnowledgeType>()
  if (queryType) {
    types.add(queryType)
  }
  if (optionType) {
    types.add(optionType)
  }

  if (types.size === 0) {
    return { params: [], matched: false }
  }

  const params = Array.from(types)
  const clause =
    params.length === 1
      ? "k.type = ?"
      : `k.type IN (${params.map(() => "?").join(",")})`

  return { clause, params, matched: true }
}

const buildPathClause = (
  queryPath?: string,
  includeAncestorsQuery?: boolean,
  optionPath?: string,
  includeAncestorsOption?: boolean
): ClauseResult => {
  const paths = new Set<string>()

  if (queryPath) {
    const resolved = includeAncestorsQuery
      ? buildAncestors(queryPath)
      : [queryPath]
    for (const path of resolved) {
      paths.add(path)
    }
  }

  if (optionPath) {
    const resolved = includeAncestorsOption
      ? buildAncestors(optionPath)
      : [optionPath]
    for (const path of resolved) {
      paths.add(path)
    }
  }

  if (paths.size === 0) {
    return { params: [], matched: false }
  }

  const params = Array.from(paths)
  const placeholders = params.map(() => "?").join(",")
  return {
    clause: `k.path IN (${placeholders})`,
    params,
    matched: true,
  }
}

const buildPatternClause = (
  queryPattern?: string,
  optionPattern?: string
): ClauseResult => {
  const patterns = new Set<string>()

  if (queryPattern) {
    patterns.add(toSqlLikePattern(queryPattern))
  }

  if (optionPattern) {
    patterns.add(toSqlLikePattern(optionPattern))
  }

  if (patterns.size === 0) {
    return { params: [], matched: false }
  }

  const params = Array.from(patterns)
  let clause: string

  if (params.length === 1) {
    clause = "k.path LIKE ? ESCAPE '\\'"
  } else {
    const likeClauses = params
      .map(() => "k.path LIKE ? ESCAPE '\\'")
      .join(" OR ")
    clause = `(${likeClauses})`
  }

  return { clause, params, matched: true }
}

const buildFullTextWhere = (
  searchTerm: string,
  minScore: number,
  clauseResults: ClauseResult[]
): { whereClauses: string[]; whereParams: Array<string | number> } => {
  const whereClauses = ["fts_main_knowledge.match_bm25(k.id, ?) IS NOT NULL"]
  const whereParams: Array<string | number> = [searchTerm]

  for (const result of clauseResults) {
    if (result.clause) {
      whereClauses.push(result.clause)
      whereParams.push(...result.params)
    }
  }

  if (minScore > DEFAULT_MIN_SCORE) {
    whereClauses.push("fts_main_knowledge.match_bm25(k.id, ?) >= ?")
    whereParams.push(searchTerm, minScore)
  }

  return { whereClauses, whereParams }
}

type FullTextPreparation = {
  selectParams: Array<string | number>
  whereSql: string
  whereParams: Array<string | number>
  matchedFields: Set<"path" | "title" | "content" | "metadata">
  limit: number
  offset: number
  sortBy: string
  sortOrder: "ASC" | "DESC"
}

const prepareFullTextSearch = (
  query: SearchQuery,
  options: SearchOptions | undefined,
  searchTerm: string,
  minScore: number
): FullTextPreparation => {
  const typeClause = buildTypeClause(query.type, options?.filters?.type)
  const pathClause = buildPathClause(
    query.path,
    query.includeAncestors,
    options?.filters?.path,
    options?.filters?.includeAncestors
  )
  const patternClause = buildPatternClause(
    query.pattern,
    options?.filters?.pattern
  )

  const { whereClauses, whereParams } = buildFullTextWhere(
    searchTerm,
    minScore,
    [typeClause, pathClause, patternClause]
  )

  const matchedFields = new Set<"path" | "title" | "content" | "metadata">([
    "content",
    "title",
  ])

  if (pathClause.matched || patternClause.matched) {
    matchedFields.add("path")
  }

  if (typeClause.matched) {
    matchedFields.add("metadata")
  }

  const limit = options?.limit ?? query.limit ?? DEFAULT_LIMIT
  const offset = options?.offset ?? query.offset ?? DEFAULT_OFFSET

  const sortColumnMap: Record<string, string> = {
    relevance: "score",
    path: "k.path",
    title: "k.title",
    createdAt: "k.created_at",
    updatedAt: "k.updated_at",
  }

  const sortBy = sortColumnMap[query.sortBy ?? "relevance"] ?? "score"
  const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC"

  return {
    selectParams: [searchTerm],
    whereSql: `WHERE ${whereClauses.join(" AND ")}`,
    whereParams,
    matchedFields,
    limit,
    offset,
    sortBy,
    sortOrder,
  }
}

const mergeKnowledgeEntry = (
  existing: KnowledgeEntry,
  updates: UpdateKnowledgeInput
): KnowledgeEntry => {
  const mergedPath = updates.path ?? existing.path
  const mergedMetadata =
    updates.metadata !== undefined ? updates.metadata : existing.metadata

  return {
    ...existing,
    ...updates,
    path: mergedPath,
    type: updates.type ?? existing.type,
    title: updates.title ?? existing.title,
    content: updates.content ?? existing.content,
    metadata: mergedMetadata,
    updatedAt: Date.now(),
    ancestors: buildAncestors(mergedPath),
  }
}

const executeKnowledgeUpdate = async (
  conn: DuckDBConnection,
  logger: Logger,
  id: string,
  entry: KnowledgeEntry
): Promise<void> => {
  const updatedAtIso = new Date(entry.updatedAt).toISOString()

  await conn.run("BEGIN TRANSACTION")

  try {
    await conn.run(
      "UPDATE knowledge SET type = ?, path = ?, title = ?, content = ?, metadata = ?, updated_at = ? WHERE id = ?",
      [
        entry.type,
        entry.path,
        entry.title,
        entry.content,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        updatedAtIso,
        id,
      ]
    )

    await conn.run("COMMIT")
  } catch (error) {
    await safeRollback(conn, logger)
    throw error
  }
}

const openDatabaseResources = async (
  location: string
): Promise<{ connection: DuckDBConnection; instance: DuckDBInstance }> => {
  const instance = await DuckDBInstance.create(location)
  const connection = await instance.connect()
  return { connection, instance }
}

const cleanupResources = (
  connection: DuckDBConnection | undefined,
  instance: DuckDBInstance | undefined,
  logger: Logger
): Error | undefined => {
  let lastError: Error | undefined

  if (connection) {
    try {
      connection.disconnectSync()
    } catch (error) {
      logger.error({ err: error }, "Failed to disconnect connection")
      if (error instanceof Error) {
        lastError = error
      }
    }
  }

  if (instance) {
    try {
      instance.closeSync()
    } catch (error) {
      logger.error({ err: error }, "Failed to close DuckDB instance")
      if (error instanceof Error) {
        lastError = error
      }
    }
  }

  return lastError
}

const mapRowToSearchResult = (
  row: KnowledgeRow,
  matchedFields: Array<"path" | "title" | "content" | "metadata">
): SearchResult => ({
  entry: mapRowToKnowledgeEntry(row),
  score: row.score === undefined || row.score === null ? 0 : Number(row.score),
  matchedFields,
  matchExplanation: "Matched via full-text search",
})

const safeRollback = async (
  conn: DuckDBConnection,
  logger: Logger
): Promise<void> => {
  try {
    await conn.run("ROLLBACK")
  } catch (rollbackError) {
    logger.error({ err: rollbackError }, "Failed to rollback transaction")
  }
}

export const createDatabase = async (
  config: DatabaseConfig
): Promise<Database> => {
  const { location, logger, environment } = config
  logger.info({ location, environment }, "Initializing DuckDB database")

  let instance: DuckDBInstance | undefined
  let connection: DuckDBConnection | undefined

  try {
    const resources = await openDatabaseResources(location)
    connection = resources.connection
    instance = resources.instance
    await initializeSchema(connection, logger)
    logger.info("Database schema initialized successfully")
  } catch (error) {
    logger.error({ err: error }, "Failed to initialize database")
    cleanupResources(connection, instance, logger)
    throw new DatabaseError("Database initialization failed", toError(error))
  }

  if (!(connection && instance)) {
    throw new DatabaseError(
      "Database initialization failed: missing DuckDB resources"
    )
  }

  const conn = connection
  const dbInstance = instance

  const acquireLock = async (
    operation: string
  ): Promise<() => Promise<void>> => {
    try {
      return await lockfile.lock(location, LOCK_OPTIONS)
    } catch (error) {
      logger.error(
        { err: error, operation, location },
        "Failed to acquire database lock"
      )
      throw new DatabaseError("Failed to acquire database lock", toError(error))
    }
  }

  const releaseLock = async (
    release: () => Promise<void>,
    operation: string
  ): Promise<void> => {
    try {
      await release()
    } catch (error) {
      logger.error(
        { err: error, operation, location },
        "Failed to release database lock"
      )
    }
  }

  const withDatabaseLock = async <T>(
    operation: string,
    action: () => Promise<T>
  ): Promise<T> => {
    const release = await acquireLock(operation)
    try {
      return await action()
    } finally {
      await releaseLock(release, operation)
    }
  }

  const storeKnowledge = async (
    entry: StoreKnowledgeInput
  ): Promise<KnowledgeEntry> =>
    withDatabaseLock("storeKnowledge", async () => {
      const id = randomUUID()
      const createdAt = Date.now()
      const updatedAt = createdAt
      const createdAtIso = new Date(createdAt).toISOString()
      const updatedAtIso = new Date(updatedAt).toISOString()

      logger.debug(
        { id, path: entry.path, type: entry.type },
        "Storing knowledge entry"
      )

      try {
        await conn.run("BEGIN TRANSACTION")

        await conn.run(
          `
            INSERT INTO knowledge (
              id, type, path, title, content, metadata, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            id,
            entry.type,
            entry.path,
            entry.title,
            entry.content,
            entry.metadata ? JSON.stringify(entry.metadata) : null,
            createdAtIso,
            updatedAtIso,
          ]
        )

        await conn.run("COMMIT")

        const stored: KnowledgeEntry = {
          id,
          ...entry,
          metadata: entry.metadata,
          createdAt,
          updatedAt,
          ancestors: buildAncestors(entry.path),
        }

        logger.info({ id }, "Knowledge entry stored")
        return stored
      } catch (error) {
        await safeRollback(conn, logger)
        logger.error(
          { err: error, path: entry.path },
          "Failed to store knowledge entry"
        )
        throw new DatabaseError(
          "Failed to store knowledge entry",
          toError(error)
        )
      }
    })

  const getKnowledge = async (id: string): Promise<KnowledgeEntry | null> => {
    try {
      const reader = await conn.runAndReadAll(
        "SELECT * FROM knowledge WHERE id = ?",
        [id]
      )

      const rawRows = reader.getRowObjects() as Record<string, unknown>[]
      const firstRow = rawRows[0]
      if (!firstRow) {
        return null
      }

      return mapRowToKnowledgeEntry(coerceRow(firstRow))
    } catch (error) {
      logger.error({ err: error, id }, "Failed to fetch knowledge entry")
      throw new DatabaseError("Failed to fetch knowledge entry", toError(error))
    }
  }

  const updateKnowledge = async (
    id: string,
    updates: UpdateKnowledgeInput
  ): Promise<KnowledgeEntry> =>
    withDatabaseLock("updateKnowledge", async () => {
      if (Object.keys(updates).length === 0) {
        const existing = await getKnowledge(id)
        if (!existing) {
          throw new KnowledgeNotFoundError(id, "id")
        }
        return existing
      }

      const existing = await getKnowledge(id)
      if (!existing) {
        throw new KnowledgeNotFoundError(id, "id")
      }

      const merged = mergeKnowledgeEntry(existing, updates)

      logger.debug({ id }, "Updating knowledge entry")

      try {
        await executeKnowledgeUpdate(conn, logger, id, merged)
        logger.info({ id }, "Knowledge entry updated")
        return merged
      } catch (error) {
        logger.error({ err: error, id }, "Failed to update knowledge entry")
        throw new DatabaseError(
          "Failed to update knowledge entry",
          toError(error)
        )
      }
    })

  const deleteKnowledge = async (id: string): Promise<void> =>
    withDatabaseLock("deleteKnowledge", async () => {
      logger.debug({ id }, "Deleting knowledge entry")
      try {
        await conn.run("DELETE FROM knowledge WHERE id = ?", [id])
        logger.info({ id }, "Knowledge entry deleted")
      } catch (error) {
        logger.error({ err: error, id }, "Failed to delete knowledge entry")
        throw new DatabaseError(
          "Failed to delete knowledge entry",
          toError(error)
        )
      }
    })

  const listKnowledge = async (
    type?: KnowledgeType
  ): Promise<KnowledgeEntry[]> => {
    try {
      const sql = type
        ? "SELECT * FROM knowledge WHERE type = ? ORDER BY created_at DESC"
        : "SELECT * FROM knowledge ORDER BY created_at DESC"
      const params = type ? [type] : []
      const reader = await conn.runAndReadAll(sql, params)
      const rawRows = reader.getRowObjects() as Record<string, unknown>[]
      return rawRows.map(coerceRow).map(mapRowToKnowledgeEntry)
    } catch (error) {
      logger.error({ err: error, type }, "Failed to list knowledge entries")
      throw new DatabaseError(
        "Failed to list knowledge entries",
        toError(error)
      )
    }
  }

  const searchByPath = async (
    query: PathSearchQuery
  ): Promise<PathSearchResults> => {
    logger.debug({ query }, "Executing path search")

    const { whereSql, params, sortColumn, sortOrder, limit, offset } =
      preparePathSearch(query)

    const baseSql = `SELECT * FROM knowledge ${whereSql}`

    try {
      const countParams = [...params]
      const countReader = await conn.runAndReadAll(
        `SELECT COUNT(*) as total FROM knowledge ${whereSql}`,
        countParams
      )
      const totalRow = countReader.getRowObjects()[0] as { total: number }
      const total = totalRow ? Number(totalRow.total) : 0

      const reader = await conn.runAndReadAll(
        `${baseSql} ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      )

      const rawRows = reader.getRowObjects() as Record<string, unknown>[]
      const entries = rawRows.map(coerceRow).map(mapRowToKnowledgeEntry)
      const hasMore = offset + entries.length < total

      logger.info({ returned: entries.length, total }, "Path search completed")

      return {
        entries,
        total,
        offset,
        limit,
        hasMore,
        matchedPattern: query.pattern,
      }
    } catch (error) {
      logger.error({ err: error, query }, "Path search failed")
      throw new DatabaseError("Path search failed", toError(error))
    }
  }

  const searchByContent = async (
    query: SearchQuery,
    options?: SearchOptions
  ): Promise<SearchResults> => {
    if (!query.content) {
      throw new ValidationError(
        "Content query is required for full-text search"
      )
    }

    logger.debug({ query, options }, "Executing full-text search")

    const searchTerm = query.content
    const minScore = options?.minScore ?? query.minScore ?? DEFAULT_MIN_SCORE
    const start = performance.now()

    const {
      selectParams,
      whereSql,
      whereParams,
      matchedFields,
      limit,
      offset,
      sortBy,
      sortOrder,
    } = prepareFullTextSearch(query, options, searchTerm, minScore)

    const sql = `
      SELECT k.*, fts_main_knowledge.match_bm25(k.id, ?) AS score
      FROM knowledge k
      ${whereSql}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ?
      OFFSET ?
    `

    try {
      const reader = await conn.runAndReadAll(sql, [
        ...selectParams,
        ...whereParams,
        limit,
        offset,
      ])

      const rawRows = reader.getRowObjects() as Record<string, unknown>[]
      const rows = rawRows.map(coerceRow)
      const fields = Array.from(matchedFields)
      const results = rows.map((row) => mapRowToSearchResult(row, fields))

      const countSql = `
        SELECT COUNT(*) AS total
        FROM knowledge k
        ${whereSql}
      `
      const countReader = await conn.runAndReadAll(countSql, whereParams)
      const countRow = countReader.getRowObjects()[0] as { total: number }
      const total = countRow ? Number(countRow.total) : 0

      const executionTime = performance.now() - start
      const hasMore = offset + results.length < total

      logger.info(
        { returned: results.length, total, executionTime },
        "Full-text search completed"
      )

      return {
        results,
        total,
        offset,
        limit,
        hasMore,
        executionTime,
        query,
      }
    } catch (error) {
      logger.error({ err: error, query }, "Full-text search failed")
      throw new DatabaseError("Full-text search failed", toError(error))
    }
  }

  const dispose = (): Promise<void> => {
    logger.info("Closing DuckDB connection")
    const cleanupError = cleanupResources(conn, dbInstance, logger)
    if (cleanupError) {
      return Promise.reject(
        new DatabaseError("Failed to release database resources", cleanupError)
      )
    }
    return Promise.resolve()
  }

  return {
    storeKnowledge,
    getKnowledge,
    updateKnowledge,
    deleteKnowledge,
    searchByPath,
    searchByContent,
    listKnowledge,
    dispose,
  }
}
