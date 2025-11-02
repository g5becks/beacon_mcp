import { performance } from "node:perf_hooks"
import { convertGlobToLike, matchGlob } from "../query/glob-matcher.js"
import { getPathAncestors } from "../query/path-resolver.js"
import { QueryBuilder } from "../query/query-builder.js"
import type { ApplicationContext, AppPlugin } from "../types/app-context.js"
import {
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from "../types/constants.js"
import type { SearchOptions } from "../types/database.js"
import { PluginDependencyError, PluginInitError } from "../types/errors.js"
import type { QueryEngine, QueryPlan } from "../types/query-engine.js"
import type {
  PathSearchQuery,
  PathSearchResults,
  SearchQuery,
  SearchResults,
} from "../types/search.js"

type SqlDirection = "ASC" | "DESC"

const PATH_SORT_FIELDS = {
  path: "knowledge.path",
  title: "knowledge.title",
  createdAt: "knowledge.created_at",
  updatedAt: "knowledge.updated_at",
} as const

const SEARCH_SORT_FIELDS = {
  path: "knowledge.path",
  title: "knowledge.title",
  createdAt: "knowledge.created_at",
  updatedAt: "knowledge.updated_at",
  relevance: "score",
} as const

const toDirection = (
  value: string | undefined,
  fallback: SqlDirection
): SqlDirection => {
  if (typeof value === "string" && value.toLowerCase() === "desc") {
    return "DESC"
  }
  if (typeof value === "string" && value.toLowerCase() === "asc") {
    return "ASC"
  }
  return fallback
}

type PathSortKey = keyof typeof PATH_SORT_FIELDS
type SearchSortKey = keyof typeof SEARCH_SORT_FIELDS

const resolvePathSortField = (field?: PathSortKey): string =>
  PATH_SORT_FIELDS[field ?? "path"]

const resolveSearchSortField = (
  field: SearchSortKey | undefined,
  hasScore: boolean
): string => {
  if (hasScore) {
    return SEARCH_SORT_FIELDS[field ?? "relevance"]
  }
  if (!field || field === "relevance") {
    return SEARCH_SORT_FIELDS.path
  }
  return SEARCH_SORT_FIELDS[field]
}

const resolveNumber = (value: number | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

const resolveLimit = (value: number | undefined, fallback: number): number =>
  resolveNumber(value, fallback)

const resolveOffset = (value: number | undefined, fallback: number): number =>
  resolveNumber(value, fallback)

const toPathPlan = (query: PathSearchQuery): QueryPlan => {
  const builder = new QueryBuilder("knowledge")

  if (query.type) {
    builder.whereType(query.type)
  }

  if (query.path) {
    builder.wherePath(query.path, query.includeAncestors ?? false)
  }

  if (query.pattern) {
    builder.whereGlob(query.pattern)
  }

  const limit = resolveLimit(query.limit, DEFAULT_SEARCH_LIMIT)
  const offset = resolveOffset(query.offset, DEFAULT_SEARCH_OFFSET)

  builder.orderBy(
    resolvePathSortField(query.sortBy as PathSortKey | undefined),
    toDirection(query.sortOrder, "ASC")
  )
  builder.limit(limit)
  builder.offset(offset)

  const { sql, params } = builder.build()

  return {
    builder,
    sql,
    params,
    limit,
    offset,
  }
}

const toSearchPlan = (
  query: SearchQuery,
  options?: SearchOptions
): QueryPlan => {
  const builder = new QueryBuilder("knowledge")

  const filters = options?.filters

  const typeFilter = filters?.type ?? query.type
  if (typeFilter) {
    builder.whereType(typeFilter)
  }

  const includeAncestors =
    filters?.includeAncestors ?? query.includeAncestors ?? false
  const pathFilter = filters?.path ?? query.path
  if (pathFilter) {
    builder.wherePath(pathFilter, includeAncestors)
  }

  const patternFilter = filters?.pattern ?? query.pattern
  if (patternFilter) {
    builder.whereGlob(patternFilter)
  }

  const hasContentQuery =
    typeof query.content === "string" && query.content.length > 0
  if (hasContentQuery) {
    const minScore = resolveNumber(options?.minScore ?? query.minScore, 0)
    builder.whereFullText(query.content as string, minScore)
  }

  const limit = resolveLimit(
    options?.limit ?? query.limit,
    DEFAULT_SEARCH_LIMIT
  )
  const offset = resolveOffset(
    options?.offset ?? query.offset,
    DEFAULT_SEARCH_OFFSET
  )

  builder.limit(limit)
  builder.offset(offset)

  const sortField = resolveSearchSortField(
    query.sortBy as SearchSortKey | undefined,
    hasContentQuery
  )
  const direction = toDirection(
    query.sortOrder,
    sortField === "score" ? "DESC" : "ASC"
  )
  builder.orderBy(sortField, direction)

  const { sql, params } = hasContentQuery
    ? builder.buildWithScore()
    : builder.build()

  return {
    builder,
    sql,
    params,
    limit,
    offset,
  }
}

const createQueryEngine = (app: ApplicationContext): QueryEngine => {
  const { database, logger } = app
  if (!database) {
    throw new PluginDependencyError("QueryEngine", "Database")
  }
  if (!logger) {
    throw new PluginDependencyError("QueryEngine", "Logger")
  }

  const executePathSearch = (
    query: PathSearchQuery
  ): Promise<PathSearchResults> => {
    logger.debug({ query }, "Executing path search via query engine")
    return database.searchByPath(query)
  }

  const executeSearch = async (
    query: SearchQuery,
    options?: SearchOptions
  ): Promise<SearchResults> => {
    const hasContentQuery =
      typeof query.content === "string" && query.content.length > 0

    if (hasContentQuery) {
      logger.debug(
        { query, options },
        "Executing content search via query engine"
      )
      return database.searchByContent(query, options)
    }

    logger.debug(
      { query, options },
      "Delegating path search through query engine"
    )
    const start = performance.now()

    const pathSortBy: PathSearchQuery["sortBy"] =
      query.sortBy && query.sortBy !== "relevance"
        ? (query.sortBy as PathSearchQuery["sortBy"])
        : "path"

    const pathQuery: PathSearchQuery = {
      path: query.path,
      pattern: query.pattern,
      type: query.type,
      includeAncestors: query.includeAncestors,
      limit: options?.limit ?? query.limit ?? DEFAULT_SEARCH_LIMIT,
      offset: options?.offset ?? query.offset ?? DEFAULT_SEARCH_OFFSET,
      sortBy: pathSortBy,
      sortOrder: query.sortOrder ?? "asc",
    }

    const results = await database.searchByPath(pathQuery)
    const executionTime = performance.now() - start

    return {
      results: results.entries.map((entry) => ({
        entry,
        score: 1,
        matchedFields: ["path"] as Array<
          "path" | "title" | "content" | "metadata"
        >,
        matchedTerms: undefined,
        snippets: undefined,
        matchExplanation: "Matched by path filters",
      })),
      total: results.total,
      offset: results.offset,
      limit: results.limit,
      hasMore: results.hasMore,
      executionTime,
      query,
    }
  }

  return {
    resolveAncestors: getPathAncestors,
    matchPattern: matchGlob,
    toSqlPattern: convertGlobToLike,
    createPathPlan: toPathPlan,
    createSearchPlan: toSearchPlan,
    executePathSearch,
    executeSearch,
  }
}

export const queryEnginePlugin: AppPlugin = (app: ApplicationContext): void => {
  try {
    if (!app.database) {
      throw new PluginDependencyError("QueryEngine", "Database")
    }
    if (!app.logger) {
      throw new PluginDependencyError("QueryEngine", "Logger")
    }

    const queryEngine = createQueryEngine(app)
    app.queryEngine = queryEngine

    app.logger.info({ module: "query-engine" }, "Query engine initialized")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (app.logger) {
      app.logger.error({ err: error }, "Query engine initialization failed")
    }

    throw new PluginInitError("QueryEngine", message, error)
  }
}
