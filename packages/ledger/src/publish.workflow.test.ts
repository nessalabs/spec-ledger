import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const REPO = join(import.meta.dirname, "../../..")

describe("publish workflow (SLC-04)", () => {
  it("publish.yml exists with release-only live publish and dry-run dispatch", () => {
    const path = join(REPO, ".github/workflows/publish.yml")
    assert.ok(existsSync(path))
    const y = readFileSync(path, "utf8")
    assert.match(y, /name:\s*publish/)
    assert.match(y, /types:\s*\[published\]/)
    assert.match(y, /workflow_dispatch:/)
    assert.match(y, /dry_run/)
    assert.match(y, /NPM_TOKEN/)
    assert.match(y, /@nessalabs/)
    assert.match(y, /pnpm publish/)
    assert.match(y, /dry-run/)
    assert.match(y, /non-release event — forcing dry-run/)
    assert.doesNotMatch(y, /on:\s*\n\s*push:/)
    assert.doesNotMatch(y, /pull_request:/)
  })

  it("ci.yml does not publish to npm", () => {
    const y = readFileSync(join(REPO, ".github/workflows/ci.yml"), "utf8")
    assert.doesNotMatch(y, /npm publish|pnpm publish/)
  })
})
