import type { DuckDBConnection } from "@duckdb/node-api"
import type { Logger } from "../types/logger.js"

const KNOWLEDGE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS knowledge (
    id VARCHAR PRIMARY KEY,
    type VARCHAR NOT NULL CHECK (type IN ('rule', 'decision', 'details')),
    path VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    content VARCHAR NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`

const INDEX_STATEMENTS = [
  "CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type)",
  "CREATE INDEX IF NOT EXISTS idx_knowledge_path ON knowledge(path)",
]

const FTS_STATEMENT = `
  PRAGMA create_fts_index(
    'knowledge',
    'id',
    'title',
    'content',
    stemmer = 'porter',
    stopwords = 'english',
    strip_accents = 1,
    lower = 1,
    overwrite = 0
  )
`

const runStatements = async (
  conn: DuckDBConnection,
  statements: string[],
  logger: Logger
) => {
  for (const statement of statements) {
    await conn.run(statement)
    logger.debug({ statement }, "Executed migration statement")
  }
}

export const initializeSchema = async (
  conn: DuckDBConnection,
  logger: Logger
): Promise<void> => {
  logger.debug("Initializing DuckDB schema")

  await conn.run(KNOWLEDGE_TABLE_SQL)
  logger.debug("Knowledge table ensured")

  await runStatements(conn, INDEX_STATEMENTS, logger)
  logger.debug("Knowledge indexes ensured")

  await conn.run(FTS_STATEMENT)
  logger.debug("Knowledge FTS index ensured")
}
