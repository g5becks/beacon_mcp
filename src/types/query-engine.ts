import type { QueryBuilder } from "../query/query-builder.js"
import type { SearchOptions } from "./database.js"
import type {
  PathSearchQuery,
  PathSearchResults,
  SearchQuery,
  SearchResults,
} from "./search.js"

export type QueryPlan = {
  builder: QueryBuilder
  sql: string
  params: Array<string | number>
  limit?: number
  offset?: number
}

export type QueryEngine = {
  resolveAncestors(path: string): string[]
  matchPattern(pattern: string, value: string): boolean
  toSqlPattern(pattern: string): string
  createPathPlan(query: PathSearchQuery): QueryPlan
  createSearchPlan(query: SearchQuery, options?: SearchOptions): QueryPlan
  executePathSearch(query: PathSearchQuery): Promise<PathSearchResults>
  executeSearch(
    query: SearchQuery,
    options?: SearchOptions
  ): Promise<SearchResults>
}
