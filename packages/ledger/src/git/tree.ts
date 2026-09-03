import { spawnSync } from "node:child_process"
import { sha256Stable } from "../fs/load.js"

function git(repoRoot: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" })
  return { ok: r.status === 0, out: (r.stdout || "").replace(/\n$/, "") }
}

/** Content-ish digest of HEAD tracked paths + dirty porcelain. */
export function computeTreeDigest(repoRoot: string): string {
  const head = git(repoRoot, ["rev-parse", "HEAD"])
  const ls = git(repoRoot, ["ls-tree", "-r", "HEAD", "--name-only"])
  const status = git(repoRoot, ["status", "--porcelain", "-uall"])
  const dirty = status.ok
    ? status.out
        .split("\n")
        .filter(Boolean)
        .map((line) => line.slice(3).trim().replace(/^"+|"+$/g, ""))
        .filter(Boolean)
        .sort()
    : []
  return sha256Stable({
    head: head.ok ? head.out : null,
    tracked: ls.ok ? ls.out.split("\n").filter(Boolean).sort() : [],
    dirty,
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
