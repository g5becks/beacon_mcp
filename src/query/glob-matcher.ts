import { Minimatch } from "minimatch"

const ROOT_PATH = "/"
const LIKE_WILDCARD = "%"
const LIKE_SINGLE = "_"

const specialLikeChars = /[%_]/g
const trailingSlashRegex = /\/+$/u
const multipleSlashRegex = /\/{2,}/g
const escapeLikeChar = (match: string) => `\\${match}`

const splitNegation = (
  pattern: string
): { negated: boolean; value: string } => {
  if (pattern.startsWith("!")) {
    return { negated: true, value: pattern.slice(1) }
  }
  return { negated: false, value: pattern }
}

const collapsePath = (input: string): string => {
  const replaced = input.replace(/\\/g, "/").trim()
  if (replaced.length === 0) {
    return ROOT_PATH
  }

  const withoutPrefix = replaced.startsWith("./") ? replaced.slice(2) : replaced

  const withoutTrailing = withoutPrefix.replace(trailingSlashRegex, "")
  const collapsed = withoutTrailing.replace(multipleSlashRegex, "/")

  if (collapsed.length === 0) {
    return ROOT_PATH
  }

  return collapsed.startsWith(ROOT_PATH)
    ? collapsed
    : `${ROOT_PATH}${collapsed}`
}

const normalizePatternForMatcher = (pattern: string): string => {
  const trimmed = pattern.trim()
  if (trimmed.length === 0) {
    return "**"
  }
  if (trimmed === "**") {
    return "**"
  }
  return collapsePath(trimmed)
}

const normalizePathForMatcher = (path: string): string => collapsePath(path)

const toLikeSegments = (pattern: string): string[] => {
  const collapsed = collapsePath(pattern)
  if (collapsed === ROOT_PATH) {
    return []
  }

  return collapsed
    .slice(1)
    .split("/")
    .filter((segment) => segment.length > 0)
}

const segmentToLike = (segment: string): string => {
  if (segment === "**") {
    return LIKE_WILDCARD
  }

  const escaped = segment.replace(specialLikeChars, escapeLikeChar)

  return escaped
    .replace(/\*\*/g, LIKE_WILDCARD)
    .replace(/\*/g, LIKE_WILDCARD)
    .replace(/\?/g, LIKE_SINGLE)
}

const createMatcher = (pattern: string): Minimatch =>
  new Minimatch(pattern, {
    dot: true,
    nocomment: true,
    nonegate: true,
    flipNegate: false,
    nocase: false,
    allowWindowsEscape: false,
  })

const buildPatternVariants = (pattern: string): string[] => {
  const variants = new Set<string>([pattern])
  if (pattern.startsWith(ROOT_PATH)) {
    variants.add(pattern.slice(1))
  }
  if (pattern === ROOT_PATH) {
    variants.add("")
  }
  return Array.from(variants)
}

const buildCandidateVariants = (value: string): string[] => {
  const variants = new Set<string>([value])
  if (value.startsWith(ROOT_PATH)) {
    variants.add(value.slice(1))
  }
  if (value === ROOT_PATH) {
    variants.add("")
  }
  return Array.from(variants)
}

export const matchGlob = (pattern: string, path: string): boolean => {
  const { negated, value } = splitNegation(pattern)
  const matcherPattern = normalizePatternForMatcher(value)
  const candidate = normalizePathForMatcher(path)

  const patternVariants = buildPatternVariants(matcherPattern)
  const candidateVariants = buildCandidateVariants(candidate)

  let matched = false

  for (const variantPattern of patternVariants) {
    const matcher = createMatcher(
      variantPattern.length === 0 ? "" : variantPattern
    )
    for (const variantCandidate of candidateVariants) {
      if (matcher.match(variantCandidate)) {
        matched = true
        break
      }
    }
    if (matched) {
      break
    }
  }
  return negated ? !matched : matched
}

export const convertGlobToLike = (pattern: string): string => {
  const { value } = splitNegation(pattern)
  const normalized = value.trim()

  if (normalized.length === 0) {
    return LIKE_WILDCARD
  }

  const segments = toLikeSegments(normalized)

  if (segments.length === 0) {
    const collapsed = collapsePath(normalized)
    return collapsed === ROOT_PATH ? ROOT_PATH : LIKE_WILDCARD
  }

  const likeSegments = segments.map(segmentToLike)
  const like = `${ROOT_PATH}${likeSegments.join("/")}`

  return like.length === 0 ? LIKE_WILDCARD : like
}
