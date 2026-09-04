import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { INIT_EMPTY_DIRS, initLedgerDetailed } from "./init.js"
import { loadLedger } from "../fs/load.js"
import { verifyLedger } from "../verify/verify.js"

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "spec-ledger-init-"))
  spawnSync("git", ["init", "-q"], { cwd: dir })
  return dir
}

describe("spec-ledger init (SLC-01)", () => {
  it("creates the normative skeleton and writes ledger.json last-safe", () => {
    const dir = freshDir()
    const { path, warnings } = initLedgerDetailed(dir, "consumer")
    assert.equal(path, join(dir, ".spec-ledger"))
    assert.equal(warnings.length, 0)

    assert.ok(existsSync(join(path, "ledger.json")))
    assert.ok(existsSync(join(path, "vision.json")))
    assert.ok(existsSync(join(path, "policy/layers.json")))
    assert.ok(existsSync(join(path, "graph/codebase-graph.json")))
    assert.ok(existsSync(join(path, "results/.gitkeep")))

    for (const d of INIT_EMPTY_DIRS) {
      const abs = join(path, d)
      assert.ok(existsSync(abs), `missing dir ${d}`)
      assert.deepEqual(readdirSync(abs), [], `${d} should be empty`)
    }

    const vision = JSON.parse(readFileSync(join(path, "vision.json"), "utf8"))
    assert.equal(vision.schemaVersion, 1)
    assert.equal(vision.updatedBy, "init")
    assert.deepEqual(vision.nonGoals, [])
    assert.deepEqual(vision.users, [])

    const ledger = JSON.parse(readFileSync(join(path, "ledger.json"), "utf8"))
    assert.equal(ledger.name, "consumer")
    assert.equal(ledger.workstreamsDir, "workstreams")

    const graph = JSON.parse(
      readFileSync(join(path, "graph/codebase-graph.json"), "utf8"),
    )
    assert.equal(graph.system.name, "consumer")
    assert.deepEqual(graph.features, [])
    assert.deepEqual(graph.nodes, [])
  })

  it("refuses re-init when ledger.json exists", () => {
    const dir = freshDir()
    initLedgerDetailed(dir, "once")
    assert.throws(
      () => initLedgerDetailed(dir, "twice"),
      /already initialized/,
    )
  })

  it("warns when no .git is present", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-ledger-nogit-"))
    const { warnings } = initLedgerDetailed(dir, "nogit")
    assert.ok(warnings.some((w) => w.includes("no .git")))
  })

  it("verify after init invents no claim pass and bindings stay empty", () => {
    const dir = freshDir()
    initLedgerDetailed(dir, "honest")
    const report = verifyLedger(loadLedger(dir))
    assert.equal(report.claims.length, 0)
    assert.ok(!report.claims.some((c) => c.outcome === "pass"))
    assert.deepEqual(readdirSync(join(dir, ".spec-ledger/bindings")), [])
    // No binding files → nothing can carry status: pass
    assert.ok(report.ok)
  })

  it("does not leave ledger.json if only dirs were created (gate file last)", () => {
    // Simulate: ledger.json is the re-init gate; without it, init may proceed.
    const dir = freshDir()
    mkdirSync(join(dir, ".spec-ledger/claims"), { recursive: true })
    writeFileSync(join(dir, ".spec-ledger/claims/.keep"), "")
    assert.equal(existsSync(join(dir, ".spec-ledger/ledger.json")), false)
    const { path } = initLedgerDetailed(dir, "recover")
    assert.ok(existsSync(join(path, "ledger.json")))
  })
})
