import { Minimatch } from "minimatch"

const LIKE_WILDCARD = "%"
const LIKE_SINGLE = "_"

const specialLikeChars = /[%_]/g
const escapeLikeChar = (match: string) => `\\${match}`

const splitNegation = (
  pattern: string
): { negated: boolean; value: string } => {
  if (pattern.startsWith("!")) {
    return { negated: true, value: pattern.slice(1) }
  }
  return { negated: false, value: pattern }
}

const normalizePath = (input: string): string => input.replace(/\\/g, "/")

const normalizeSegments = (path: string): string[] =>
  normalizePath(path)
    .split("/")
    .filter((segment) => segment.length > 0)

const createMatcher = (pattern: string): Minimatch =>
  new Minimatch(pattern, {
    dot: true,
    nocomment: true,
    nonegate: true,
    flipNegate: false,
    nocase: false,
    allowWindowsEscape: false,
  })

export const matchGlob = (pattern: string, path: string): boolean => {
  const { negated, value } = splitNegation(pattern)
  const matcher = createMatcher(value.trim().length > 0 ? value : "**")
  const matched = matcher.match(normalizePath(path))
  return negated ? !matched : matched
}

export const convertGlobToLike = (pattern: string): string => {
  const { value } = splitNegation(pattern)
  const normalized = value.trim()

  if (normalized.length === 0) {
    return LIKE_WILDCARD
  }

  const segments = normalizeSegments(normalized)

  if (segments.length === 0) {
    return LIKE_WILDCARD
  }

  const like = segments
    .map((segment) => {
      if (segment === "**") {
        return LIKE_WILDCARD
      }

      const escaped = segment.replace(specialLikeChars, escapeLikeChar)
      return escaped
        .replace(/\*\*/g, LIKE_WILDCARD)
        .replace(/\*/g, LIKE_WILDCARD)
        .replace(/\?/g, LIKE_SINGLE)
    })
    .join("/")

  return like.length === 0 ? LIKE_WILDCARD : like
}
