import { spawnSync } from "node:child_process"
import { sha256Stable } from "../fs/load.js"

function git(repoRoot: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" })
  return { ok: r.status === 0, out: (r.stdout || "").replace(/\n$/, "") }
}

function productDirtyEntries(repoRoot: string): string[] {
  const status = git(repoRoot, ["status", "--porcelain", "-uall"])
  if (!status.ok) return []
  return status.out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      let path = line.slice(3).trim().replace(/^"+|"+$/g, "")
      if (path.includes(" -> ")) path = path.split(" -> ").at(-1)!.trim()
      return path
    })
    .filter(Boolean)
    .filter((p) => !p.startsWith(".spec-ledger/") && !p.startsWith(".spec-ledger\\"))
    .sort()
}

/** Content-addressed digest: HEAD + tracked names + dirty path→blob hashes. */
export function computeTreeDigest(repoRoot: string): string {
  const head = git(repoRoot, ["rev-parse", "HEAD"])
  const ls = git(repoRoot, ["ls-tree", "-r", "HEAD", "--name-only"])
  const dirty = productDirtyEntries(repoRoot)
  const dirtyBlobs = dirty.map((p) => {
    const h = git(repoRoot, ["hash-object", p])
    return { path: p, blob: h.ok ? h.out : null }
  })
  return sha256Stable({
    head: head.ok ? head.out : null,
    tracked: ls.ok ? ls.out.split("\n").filter(Boolean).sort() : [],
    dirtyBlobs,
  })
}

export function dirtyPaths(repoRoot: string): string[] {
  const status = git(repoRoot, ["status", "--porcelain", "-uall"])
  if (!status.ok) return []
  return status.out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      let path = line.slice(3).trim().replace(/^"+|"+$/g, "")
      if (path.includes(" -> ")) path = path.split(" -> ").at(-1)!.trim()
      return path
    })
    .filter(Boolean)
    .sort()
}

/**
 * Paths changed since base (committed + dirty).
 * Fail closed when baseCommit is set but not resolvable (shallow clone / gc).
 */
export function changedPathsSince(
  repoRoot: string,
  baseCommit: string | null | undefined,
): string[] {
  const dirty = dirtyPaths(repoRoot)
  if (!baseCommit) return dirty
  const exists = git(repoRoot, ["cat-file", "-e", `${baseCommit}^{commit}`])
  if (!exists.ok) {
    throw new Error(
      `changedPathsSince refused: baseCommit ${baseCommit} is unresolvable — cannot verify product paths (shallow clone?). Use fetch-depth: 0 for align/close.`,
    )
  }
  const names = git(repoRoot, ["diff", "--name-only", `${baseCommit}...HEAD`])
  if (!names.ok) {
    throw new Error(
      `changedPathsSince refused: git diff ${baseCommit}...HEAD failed`,
    )
  }
  const committed = names.out.split("\n").filter(Boolean)
  return [...new Set([...committed, ...dirty])].sort()
}
