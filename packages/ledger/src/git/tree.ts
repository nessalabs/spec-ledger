import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { sourceFingerprint } from "../evidence/fingerprint.js"

function git(repoRoot: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" })
  return { ok: r.status === 0, out: (r.stdout || "").replace(/\n$/, "") }
}

/** Current product content; commits and ledger-only metadata do not invalidate it. */
export function computeTreeDigest(repoRoot: string): string {
  const configPath = join(repoRoot,".spec-ledger/ledger.json")
  const generatedArtifacts = existsSync(configPath) ? JSON.parse(readFileSync(configPath,"utf8")).generatedArtifactPaths ?? [] : []
  const digest = sourceFingerprint(repoRoot, generatedArtifacts)
  if (!digest) throw new Error("cannot observe current source content")
  return digest
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
