import { posix } from "node:path"

const ROOT_PATH = "/"
const PATH_SEPARATOR = "/"

const normalizeInputPath = (filePath: string): string => {
  const replaced = filePath.replace(/\\/g, PATH_SEPARATOR).trim()
  if (replaced.length === 0) {
    return ROOT_PATH
  }

  const withLeadingSlash = replaced.startsWith(PATH_SEPARATOR)
    ? replaced
    : `${PATH_SEPARATOR}${replaced}`

  const normalized = posix.normalize(withLeadingSlash)
  return normalized === "" ? ROOT_PATH : normalized
}

const buildAncestors = (segments: string[]): string[] => {
  const ancestors: string[] = [ROOT_PATH]

  if (segments.length === 0) {
    return ancestors
  }

  let current = ""
  for (const segment of segments) {
    current = `${current}${PATH_SEPARATOR}${segment}`
    const normalized = current.startsWith(PATH_SEPARATOR)
      ? current
      : `${PATH_SEPARATOR}${current}`
    ancestors.push(posix.normalize(normalized))
  }

  return ancestors
}

export const getPathAncestors = (filePath: string): string[] => {
  const normalized = normalizeInputPath(filePath)

  if (normalized === ROOT_PATH) {
    return [ROOT_PATH]
  }

  const segments = normalized
    .split(PATH_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  return buildAncestors(segments)
}
