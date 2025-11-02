import type { KnowledgeType } from "../types/knowledge.js"
import { convertGlobToLike } from "./glob-matcher.js"
import { getPathAncestors } from "./path-resolver.js"

type OrderDirection = "ASC" | "DESC"

type WhereClause = {
  clause: string
  params: Array<string | number>
}

type QueryBuilderState = {
  table: string
  select: string
  where: WhereClause[]
  orderBy: string[]
  limit?: number
}

const createInitialState = (table: string): QueryBuilderState => ({
  table,
  select: `${table}.*`,
  where: [],
  orderBy: [],
})

const appendWhere = (state: QueryBuilderState, clause: WhereClause): void => {
  state.where.push(clause)
}

const appendOrderBy = (
  state: QueryBuilderState,
  field: string,
  direction: OrderDirection
): void => {
  state.orderBy.push(`${field} ${direction}`)
}

const serializeWhere = (
  state: QueryBuilderState
): {
  clause: string
  params: Array<string | number>
} => {
  if (state.where.length === 0) {
    return { clause: "", params: [] }
  }

  const parts: string[] = []
  const params: Array<string | number> = []

  for (const entry of state.where) {
    parts.push(entry.clause)
    params.push(...entry.params)
  }

  return {
    clause: parts.join(" AND "),
    params,
  }
}

const buildSelect = (state: QueryBuilderState, withScore: boolean): string => {
  if (withScore) {
    return `SELECT ${state.table}.*, score`
  }
  return `SELECT ${state.select}`
}

const buildFrom = (state: QueryBuilderState): string => `FROM ${state.table}`

const buildOrderBy = (state: QueryBuilderState): string => {
  if (state.orderBy.length === 0) {
    return ""
  }
  return `ORDER BY ${state.orderBy.join(", ")}`
}

const buildLimit = (state: QueryBuilderState): string => {
  if (typeof state.limit !== "number") {
    return ""
  }
  return `LIMIT ${state.limit}`
}

const hasFullText = (state: QueryBuilderState): boolean =>
  state.where.some((entry) => entry.clause.includes("match_bm25"))

const buildSql = (
  state: QueryBuilderState,
  options: { withScore: boolean }
): { sql: string; params: Array<string | number> } => {
  const { clause, params } = serializeWhere(state)

  const select = buildSelect(state, options.withScore)
  const from = buildFrom(state)
  const where = clause ? `WHERE ${clause}` : ""
  const orderBy = buildOrderBy(state)
  const limit = buildLimit(state)

  const sql = [select, from, where, orderBy, limit]
    .filter((section) => section.length > 0)
    .join(" ")

  return { sql, params }
}

export type QueryFilter = {
  type?: KnowledgeType
  path?: string
  includeAncestors?: boolean
  library?: string
  glob?: string
  fullText?: {
    query: string
    minScore?: number
  }
}

export class QueryBuilder {
  private readonly state: QueryBuilderState

  constructor(baseTable = "knowledge") {
    this.state = createInitialState(baseTable)
  }

  filter(filter: QueryFilter): this {
    if (filter.type) {
      this.whereType(filter.type)
    }

    if (filter.path) {
      this.wherePath(filter.path, filter.includeAncestors ?? false)
    }

    if (filter.library) {
      this.whereLibrary(filter.library)
    }

    if (filter.glob) {
      this.whereGlob(filter.glob)
    }

    if (filter.fullText) {
      this.whereFullText(filter.fullText.query, filter.fullText.minScore ?? 0)
    }

    return this
  }

  select(fields: string): this {
    this.state.select = fields
    return this
  }

  where(clause: string, ...params: Array<string | number>): this {
    appendWhere(this.state, { clause, params })
    return this
  }

  orderBy(field: string, direction: OrderDirection = "ASC"): this {
    appendOrderBy(this.state, field, direction)
    return this
  }

  limit(count: number): this {
    this.state.limit = count
    return this
  }

  build(): { sql: string; params: Array<string | number> } {
    return buildSql(this.state, { withScore: false })
  }

  buildWithScore(): { sql: string; params: Array<string | number> } {
    if (!hasFullText(this.state)) {
      throw new Error("Full-text clause required for score query")
    }

    return buildSql(this.state, { withScore: true })
  }

  whereEquals(field: string, value: string | number): this {
    return this.where(`${this.state.table}.${field} = ?`, value)
  }

  whereType(type: KnowledgeType): this {
    return this.whereEquals("type", type)
  }

  wherePath(path: string, includeAncestors = false): this {
    if (!includeAncestors) {
      return this.where(`${this.state.table}.path = ?`, path)
    }

    const ancestors = getPathAncestors(path)
    const placeholders = ancestors.map(() => "?").join(",")
    return this.where(
      `${this.state.table}.path IN (${placeholders})`,
      ...ancestors
    )
  }

  whereGlob(pattern: string): this {
    const like = convertGlobToLike(pattern)
    return this.where(`${this.state.table}.path LIKE ? ESCAPE '\\'`, like)
  }

  whereLibrary(library: string): this {
    return this.whereEquals("library", library)
  }

  whereFullText(query: string, minScore = 0): this {
    const clause =
      minScore > 0
        ? `fts_main_knowledge.match_bm25(${this.state.table}.id, ?) >= ?`
        : `fts_main_knowledge.match_bm25(${this.state.table}.id, ?) IS NOT NULL`

    const params = minScore > 0 ? [query, minScore] : [query]
    appendWhere(this.state, { clause, params })
    return this
  }

  reset(): this {
    const { table } = this.state
    this.state.select = `${table}.*`
    this.state.where = []
    this.state.orderBy = []
    this.state.limit = undefined
    return this
  }
}
