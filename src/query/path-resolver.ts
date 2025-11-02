import { posix } from "node:path"

const ROOT_PATH = "."
const PATH_SEPARATOR = "/"

const normalizeInputPath = (filePath: string): string => {
  const replaced = filePath.replace(/\\/g, PATH_SEPARATOR).trim()
  if (replaced.length === 0) {
    return ROOT_PATH
  }

  const normalized = posix.normalize(replaced)
  return normalized === "" ? ROOT_PATH : normalized
}

const buildAncestors = (segments: string[]): string[] => {
  const ancestors: string[] = [ROOT_PATH]

  if (segments.length === 0) {
    return ancestors
  }

  let current = ""
  for (const segment of segments) {
    current =
      current.length === 0 ? segment : `${current}${PATH_SEPARATOR}${segment}`
    ancestors.push(current)
  }

  return ancestors
}

const stripLeadingRoot = (path: string): string => {
  if (path === ROOT_PATH) {
    return ""
  }

  if (path.startsWith("./")) {
    return path.slice(2)
  }

  if (path.startsWith(`${ROOT_PATH}${PATH_SEPARATOR}`)) {
    return path.slice(2)
  }

  return path
}

export const getPathAncestors = (filePath: string): string[] => {
  const normalized = normalizeInputPath(filePath)

  if (normalized === ROOT_PATH) {
    return [ROOT_PATH]
  }

  const cleaned = stripLeadingRoot(normalized)

  const segments = cleaned
    .split(PATH_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== ROOT_PATH)

  return buildAncestors(segments)
}
