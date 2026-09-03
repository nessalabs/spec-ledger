import { posix } from "node:path"

/** Path glob / prefix helpers for align coverage. */

export const DEFAULT_ALIGN_IGNORE: readonly string[] = [
  ".spec-ledger/**",
  "node_modules/**",
  ".next/**",
  "**/node_modules/**",
  "**/.next/**",
  "dist/**",
  "**/dist/**",
  ".git/**",
]

/** Collapse `.` / `..` so prefix matches cannot be smuggled. */
export function normalizeRepoPath(path: string): string {
  const raw = path.replace(/\\/g, "/")
  return posix.normalize(raw).replace(/^\.\//, "").replace(/\/+$/, "")
}

/** Absolute paths or remaining `..` segments after normalize. */
export function isUnsafeRepoPath(path: string): boolean {
  const raw = path.replace(/\\/g, "/")
  if (raw.startsWith("/") || /^[a-zA-Z]:/.test(raw)) return true
  if (raw.split("/").includes("..")) return true
  const n = normalizeRepoPath(path)
  return n === ".." || n.startsWith("../") || n.split("/").includes("..")
}

/** True if `path` matches a locator prefix or simple `**` / `*` glob. */
export function pathMatchesPattern(path: string, pattern: string): boolean {
  const p = normalizeRepoPath(path)
  const g = normalizeRepoPath(pattern)
  if (!g || isUnsafeRepoPath(path)) return false

  if (g.startsWith("**/") && g.endsWith("/**")) {
    const mid = g.slice(3, -3)
    if (!mid) return true
    return p === mid || p.startsWith(mid + "/") || p.includes("/" + mid + "/")
  }
  if (g.startsWith("**/")) {
    const rest = g.slice(3)
    if (rest.endsWith("/**")) {
      const mid = rest.slice(0, -3)
      return p === mid || p.startsWith(mid + "/") || p.includes("/" + mid + "/")
    }
    return p === rest || p.endsWith("/" + rest) || p.includes("/" + rest + "/")
  }
  if (g.endsWith("/**")) {
    const base = g.slice(0, -3)
    return p === base || p.startsWith(base + "/")
  }
  if (g.includes("*")) {
    const re = new RegExp(
      "^" +
        g
          .split("*")
          .map(escapeRe)
          .join(".*") +
        "$",
    )
    return re.test(p)
  }
  return p === g || p.startsWith(g + "/")
}

export function isExemptPath(
  path: string,
  ignore: readonly string[] = DEFAULT_ALIGN_IGNORE,
): boolean {
  if (isUnsafeRepoPath(path)) return false
  return ignore.some((pat) => pathMatchesPattern(path, pat))
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
