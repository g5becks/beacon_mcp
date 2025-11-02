type SerializableError = {
  name?: string
  message?: string
  stack?: string
  [key: string]: unknown
}

const formatArgs = (message: string, args: unknown[]): string => {
  if (args.length === 0) {
    return message
  }

  const serialized = args
    .map((value) => {
      if (typeof value === "string") {
        return value
      }
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    })
    .join(" ")

  return `${message} ${serialized}`.trim()
}

const printError = (error: unknown): void => {
  if (!error) {
    return
  }

  if (error instanceof Error) {
    if (error.stack) {
      process.stderr.write(`${error.stack}\n`)
      return
    }
    process.stderr.write(`${error.message}\n`)
    return
  }

  if (typeof error === "object") {
    const serializable = error as SerializableError
    const details = JSON.stringify(serializable)
    process.stderr.write(`${details}\n`)
    return
  }

  process.stderr.write(`${String(error)}\n`)
}

export const cliLogger = {
  info(message: string, ...args: unknown[]): void {
    process.stderr.write(`${formatArgs(`[info] ${message}`, args)}\n`)
  },

  warn(message: string, ...args: unknown[]): void {
    process.stderr.write(`${formatArgs(`[warn] ${message}`, args)}\n`)
  },

  error(message: string, error?: unknown, ...args: unknown[]): void {
    process.stderr.write(`${formatArgs(`[error] ${message}`, args)}\n`)
    printError(error)
  },

  debug(message: string, ...args: unknown[]): void {
    if (!process.env.DEBUG) {
      return
    }
    process.stderr.write(`${formatArgs(`[debug] ${message}`, args)}\n`)
  },
}
