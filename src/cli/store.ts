import { buildCommand } from "@stricli/core"
import { startApp } from "../app.js"
import type { KnowledgeType } from "../types/knowledge.js"
import { KnowledgeTypeSchema } from "../types/knowledge.js"
import { cliLogger } from "./logger.js"

type StoreFlags = {
  library?: string
  scope?: string
  scopeValue?: string
}

type StoreArgs = [
  type: KnowledgeType,
  path: string,
  title: string,
  content: string,
]

const parseString = (value: string): string => value

const parseKnowledgeType = (value: string): KnowledgeType =>
  KnowledgeTypeSchema.parse(value)

export const storeCommand = buildCommand<StoreFlags, StoreArgs>({
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Knowledge type (rule, decision, details)",
          parse: parseKnowledgeType,
        },
        {
          brief: "Path where the knowledge applies (e.g., /src/api)",
          parse: parseString,
        },
        {
          brief: "Title of the knowledge entry",
          parse: parseString,
        },
        {
          brief: "Content in markdown format",
          parse: parseString,
        },
      ],
    },
    flags: {
      library: {
        kind: "parsed",
        parse: parseString,
        brief: "Library name (required for details type)",
        optional: true,
      },
      scope: {
        kind: "parsed",
        parse: parseString,
        brief: "Granular scope label (custom metadata)",
        optional: true,
      },
      scopeValue: {
        kind: "parsed",
        parse: parseString,
        brief: "Value associated with the scope label",
        optional: true,
      },
    },
  },
  docs: {
    brief: "Store knowledge entry",
    fullDescription: `
Store a path-scoped knowledge entry (rule, decision, or details) in the Beacon MCP database.
Paths must start with a forward slash (/) and use Unix-style separators.
`,
    customUsage: [
      {
        input:
          "store decision /src/api/users 'Audit log reason' 'All user updates must include audit reason.'",
        brief: "Store a decision entry",
      },
      {
        input:
          "store details /src/services/payments 'Stripe integration notes' '# Notes\nWe use stripe 2024 API' --library stripe",
        brief: "Store documentation details for a path",
      },
    ],
  },
  async func(flags, ...positional: StoreArgs): Promise<void> {
    try {
      const [type, rawPath, rawTitle, rawContent] = positional
      const path = rawPath.trim()
      const title = rawTitle.trim()
      const content = rawContent

      if (!path.startsWith("/")) {
        throw new Error(
          "Path must start with a forward slash (/) for consistency"
        )
      }

      if (type === "details" && !flags.library) {
        throw new Error("--library is required when storing details entries")
      }

      cliLogger.info("Storing knowledge entry...", {
        type,
        path,
        title,
      })

      const app = await startApp()

      if (!app.database) {
        throw new Error("Database not initialized")
      }

      const metadataEntries: Record<string, string> = {}
      if (flags.library) {
        metadataEntries.library = flags.library.trim()
      }
      if (flags.scope) {
        metadataEntries.scope = flags.scope.trim()
      }
      if (flags.scopeValue) {
        metadataEntries.scopeValue = flags.scopeValue.trim()
      }

      const metadata = Object.keys(metadataEntries).length
        ? metadataEntries
        : undefined

      const entry = await app.database.storeKnowledge({
        type,
        path,
        title,
        content,
        metadata,
      })

      cliLogger.info("Knowledge stored successfully", {
        id: entry.id,
        path: entry.path,
      })
      process.stdout.write(
        `Knowledge stored successfully with ID ${entry.id}\n`
      )

      await app.database.dispose()
    } catch (error) {
      cliLogger.error("Failed to store knowledge entry", error)
      process.exit(1)
    }
  },
})
