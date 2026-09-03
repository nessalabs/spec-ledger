/** Resolve markdown/doc hrefs to repo-relative paths for the shell reader. */

export function resolveRepoDocPath(
  fromPath: string,
  href: string,
): string | null {
  const raw = href.trim()
  if (!raw || raw.startsWith("#")) return null
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return null

  const [withoutHash] = raw.split("#")
  if (!withoutHash) return null

  // Site-absolute app routes (not repo files).
  if (withoutHash.startsWith("/") && !isRepoDocPath(withoutHash.slice(1))) {
    return null
  }

  let candidate = withoutHash.startsWith("/")
    ? withoutHash.slice(1)
    : withoutHash

  if (!withoutHash.startsWith("/")) {
    const fromDir = fromPath.includes("/")
      ? fromPath.slice(0, fromPath.lastIndexOf("/"))
      : ""
    const joined = fromDir ? `${fromDir}/${candidate}` : candidate
    candidate = normalizePosix(joined)
  }

  if (!candidate || candidate.startsWith("..")) return null
  if (!isRepoDocPath(candidate)) return null
  return candidate
}

export function isRepoDocPath(path: string): boolean {
  if (/\.(md|markdown|txt|json|ya?ml)$/i.test(path)) return true
  if (
    path.startsWith("docs/") ||
    path.startsWith("schemas/") ||
    path.startsWith(".spec-ledger/")
  ) {
    return true
  }
  return /^(DESIGN|AGENTS|README|CONTRIBUTING|LICENSE)(\.md)?$/i.test(path)
}

function normalizePosix(path: string): string {
  const parts = path.split("/")
  const out: string[] = []
  for (const p of parts) {
    if (!p || p === ".") continue
    if (p === "..") {
      if (!out.length) return ".."
      out.pop()
      continue
    }
    out.push(p)
  }
  return out.join("/")
}
