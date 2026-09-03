// sl-dev-break killers (T-019 / SLC-04) — treeDigest drift + base-commit fallback.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { computeTreeDigest, changedPathsSince } from "./tree.js"

function gitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "sl-tree-killer-"))
  spawnSync("git", ["init", "-q"], { cwd: dir })
  spawnSync("git", ["config", "user.email", "t@e.com"], { cwd: dir })
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir })
  writeFileSync(join(dir, "a.ts"), "export const a = 1\n")
  spawnSync("git", ["add", "."], { cwd: dir })
  spawnSync("git", ["commit", "-q", "-m", "init"], { cwd: dir })
  return dir
}

describe("KILLERS git/tree — treeDigest drift", () => {
  it("treeDigest must change when a dirty file's CONTENT changes (same path set)", () => {
    const dir = gitRepo()
    try {
      writeFileSync(join(dir, "a.ts"), "export const a = 2\n")
      const approved = computeTreeDigest(dir)
      // Attacker edits the already-dirty file AFTER align approve was stamped.
      writeFileSync(join(dir, "a.ts"), "export const a = 2; process.exit(1)\n")
      const drifted = computeTreeDigest(dir)
      assert.notEqual(
        drifted,
        approved,
        "treeDigest is path-only: content edits after approve keep the approve valid",
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("changedPathsSince must fail closed when baseCommit cannot be resolved", () => {
    const dir = gitRepo()
    try {
      writeFileSync(join(dir, "b.ts"), "export const b = 1\n")
      spawnSync("git", ["add", "."], { cwd: dir })
      spawnSync("git", ["commit", "-q", "-m", "product"], { cwd: dir })
      const bogus = "0000000000000000000000000000000000000000"
      let result: string[] | undefined
      let threw = false
      try {
        result = changedPathsSince(dir, bogus)
      } catch {
        threw = true
      }
      assert.ok(
        threw || (result && result.includes("b.ts")),
        `unresolvable base silently dropped committed product paths: ${JSON.stringify(result)}`,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
