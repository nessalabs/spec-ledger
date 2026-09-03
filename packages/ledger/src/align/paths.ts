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

/** True if `path` matches a locator prefix or simple `**` / `*` glob. */
export function pathMatchesPattern(path: string, pattern: string): boolean {
  const p = normalizeRepoPath(path)
  const g = normalizeRepoPath(pattern)
  if (!g) return false

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
  return ignore.some((pat) => pathMatchesPattern(path, pat))
}

export function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "")
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
