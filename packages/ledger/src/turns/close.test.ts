import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { initLedger } from "../cli/init.js"
import { openTurn, closeTurn, listTurns, deriveTouched, collectGitFiles } from "./close.js"
import { loadLedger } from "../fs/load.js"

function gitInit(dir: string) {
  spawnSync("git", ["init"], { cwd: dir })
  spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: dir })
  spawnSync("git", ["config", "user.name", "test"], { cwd: dir })
}

describe("turns", () => {
  it("open then close writes tool facts", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-ledger-turn-"))
    gitInit(dir)
    initLedger(dir, "turn-test")
    writeFileSync(join(dir, "hello.txt"), "hi\n")
    spawnSync("git", ["add", "."], { cwd: dir })
    spawnSync("git", ["commit", "-m", "init"], { cwd: dir })
    writeFileSync(join(dir, "hello.txt"), "hi\nbye\n")

    const opened = openTurn(dir, {
      userPrompt: "touch hello",
      restatedGoal: "Change hello.txt",
    })
    assert.equal(opened.status, "open")
    assert.equal(opened.id, "T-001")

    const closed = closeTurn(dir)
    assert.equal(closed.status, "closed")
    assert.ok(closed.facts)
    assert.ok(closed.facts!.files.some((f) => f.path === "hello.txt"))
    assert.equal(typeof closed.facts!.verify.ledgerDigest, "string")
    assert.equal(listTurns(loadLedger(dir)).length, 1)
  })

  it("maps ledger paths to claim ids", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-ledger-map-"))
    gitInit(dir)
    initLedger(dir, "map-test")
    const ledger = loadLedger(dir)
    mkdirSync(join(ledger.rootDir, "claims"), { recursive: true })
    const files = collectGitFiles(dir)
    const derived = deriveTouched(ledger, [
      ...files,
      { path: ".spec-ledger/claims/SL-001.json", kind: "added" },
    ])
    assert.ok(derived.touchedClaimIds.includes("SL-001"))
  })
})
