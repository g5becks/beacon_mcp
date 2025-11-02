import { buildCommand } from "@stricli/core"
import { startApp } from "../../app.js"
import type { KnowledgeEntry, KnowledgeType } from "../../types/knowledge.js"
import { KnowledgeTypeSchema } from "../../types/knowledge.js"
import { cliLogger } from "../logger.js"

type ListFlags = {
  type?: KnowledgeType
}

const SNIPPET_LENGTH = 200

const parseType = (value: string): KnowledgeType =>
  KnowledgeTypeSchema.parse(value.trim())

const summarizeContent = (content: string): string => {
  const normalized = content.trim()
  if (normalized.length <= SNIPPET_LENGTH) {
    return normalized
  }
  return `${normalized.slice(0, SNIPPET_LENGTH - 1)}…`
}

const formatEntry = (entry: KnowledgeEntry, index: number): string => {
  const lines = [
    `### ${index}. ${entry.title}`,
    `- **Type:** ${entry.type}`,
    `- **Path:** ${entry.path}`,
  ]

  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    lines.push("- **Metadata:**")
    for (const [key, value] of Object.entries(entry.metadata)) {
      lines.push(`  - ${key}: ${JSON.stringify(value)}`)
    }
  }

  lines.push("", summarizeContent(entry.content))

  return `${lines.join("\n")}\n`
}

const formatResults = (
  entries: KnowledgeEntry[],
  filterType?: KnowledgeType
): string => {
  const header = [
    "# Knowledge Entries",
    `Found ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`,
  ]

  if (filterType) {
    header.push(`Filtered by type: ${filterType}`)
  }

  if (entries.length === 0) {
    return `${header.join("\n")}\n\nNo entries available.\n`
  }

  const body = entries
    .map((entry, index) => formatEntry(entry, index + 1))
    .join("\n")

  return `${header.join("\n")}\n\n${body}`
}

const disposeDatabase = async (database?: {
  dispose(): Promise<void>
}): Promise<void> => {
  if (!database) {
    return
  }

  try {
    await database.dispose()
  } catch (error) {
    cliLogger.error("Failed to dispose database", error)
  }
}

export const listCommand = buildCommand<ListFlags>({
  parameters: {
    flags: {
      type: {
        kind: "parsed",
        parse: parseType,
        brief: "Filter by knowledge type",
        optional: true,
      },
    },
  },
  docs: {
    brief: "List knowledge entries",
    fullDescription: `
Display all knowledge entries stored in Beacon MCP. Use --type to filter by knowledge category.
`,
    customUsage: [
      {
        input: "list",
        brief: "List all knowledge entries",
      },
      {
        input: "list --type decision",
        brief: "List only decision records",
      },
    ],
  },
  async func(flags): Promise<void> {
    let app: Awaited<ReturnType<typeof startApp>> | undefined

    try {
      cliLogger.info("Starting list command", {
        type: flags.type ?? null,
      })

      app = await startApp()

      if (!app.database) {
        throw new Error("Database not initialized")
      }

      const entries = await app.database.listKnowledge(flags.type)
      const output = formatResults(entries, flags.type)
      process.stdout.write(`${output}\n`)

      cliLogger.info("Listing completed", {
        results: entries.length,
        type: flags.type ?? null,
      })
    } catch (error) {
      cliLogger.error("List command failed", error)
      process.exitCode = 1
    } finally {
      await disposeDatabase(app?.database)
    }
  },
})
