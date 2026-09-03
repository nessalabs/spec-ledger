import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  cpSync,
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { initLedger } from "../cli/init.js"
import { openTurn, closeTurn, listTurns, deriveTouched, collectGitFiles } from "./close.js"
import { loadLedger } from "../fs/load.js"
import { writeReview } from "../reviews/load.js"
import type { Workstream } from "../types.js"

const REPO = join(import.meta.dirname, "../../../..")

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
    }, { allowDirty: true })
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

  it("workstream open stamps contextDigest; unsealed refused", () => {
    const dir = mkdtempSync(join(tmpdir(), "sl-open-ctx-"))
    try {
      cpSync(join(REPO, ".spec-ledger"), join(dir, ".spec-ledger"), { recursive: true })
      rmSync(join(dir, ".spec-ledger/turns"), { recursive: true, force: true })
      mkdirSync(join(dir, ".spec-ledger/turns"), { recursive: true })
      spawnSync("git", ["init"], { cwd: dir })
      spawnSync("git", ["config", "user.email", "t@e.com"], { cwd: dir })
      spawnSync("git", ["config", "user.name", "t"], { cwd: dir })
      spawnSync("git", ["add", "."], { cwd: dir })
      spawnSync("git", ["commit", "-m", "init"], { cwd: dir })

      const opened = openTurn(
        dir,
        {
          userPrompt: "stamp context",
          restatedGoal: "Open with sealed slice",
          workstreamId: "W-001",
          sliceId: "SLC-02",
          featureIds: ["turns"],
        },
        { workstreamId: "W-001", sliceId: "SLC-02", featureIds: ["turns"], allowDirty: true },
      )
      assert.equal(opened.opened?.contextWorkstreamId, "W-001")
      assert.equal(opened.opened?.contextSliceId, "SLC-02")
      assert.equal(opened.opened?.contextDigest?.length, 64)
      assert.equal(opened.opened?.treeDigest?.length, 64)

      // close needs code-break; abandon by deleting for next fixture step
      rmSync(join(dir, ".spec-ledger/turns", `${opened.id}.json`))

      const wsPath = join(dir, ".spec-ledger/workstreams/W-001.json")
      const ws = JSON.parse(readFileSync(wsPath, "utf8")) as Workstream
      ws.status = "shaped"
      delete ws.seal
      writeFileSync(wsPath, JSON.stringify(ws, null, 2))
      assert.throws(
        () =>
          openTurn(
            dir,
            {
              userPrompt: "unsealed",
              restatedGoal: "should fail",
              workstreamId: "W-001",
              sliceId: "SLC-02",
            },
            { workstreamId: "W-001", sliceId: "SLC-02", allowDirty: true },
          ),
        /sealed/,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("close refuses missing code-break; approve+killers allows", () => {
    const dir = mkdtempSync(join(tmpdir(), "sl-close-gate-"))
    try {
      cpSync(join(REPO, ".spec-ledger"), join(dir, ".spec-ledger"), { recursive: true })
      // Avoid colliding with copied open/closed turns
      rmSync(join(dir, ".spec-ledger/turns"), { recursive: true, force: true })
      mkdirSync(join(dir, ".spec-ledger/turns"), { recursive: true })
      spawnSync("git", ["init"], { cwd: dir })
      spawnSync("git", ["config", "user.email", "t@e.com"], { cwd: dir })
      spawnSync("git", ["config", "user.name", "t"], { cwd: dir })
      spawnSync("git", ["add", "."], { cwd: dir })
      spawnSync("git", ["commit", "-m", "init"], { cwd: dir })

      openTurn(
        dir,
        {
          userPrompt: "gate close",
          restatedGoal: "Require code break",
          workstreamId: "W-001",
          sliceId: "SLC-02",
          featureIds: ["turns"],
        },
        { workstreamId: "W-001", sliceId: "SLC-02", featureIds: ["turns"], allowDirty: true },
      )

      assert.throws(() => closeTurn(dir), /requireCodeBreak/)

      writeReview(dir, {
        schemaVersion: 1,
        id: "T-001/R-01",
        turnId: "T-001",
        kind: "adversarial",
        target: "code",
        reviewer: "agent:test",
        verdict: "comment",
        summary: "note only",
        plainSummary: "A note only — not a pass.",
      })
      assert.throws(() => closeTurn(dir), /requireCodeBreak/)

      writeReview(dir, {
        schemaVersion: 1,
        id: "T-001/R-02",
        turnId: "T-001",
        kind: "adversarial",
        target: "code",
        reviewer: "agent:test",
        verdict: "approve",
        summary: "killers ran",
        plainSummary: "Attack tests ran and this slice may ship.",
        killersCited: ["packages/ledger/src/turns/close.test.ts::close refuses"],
      })
      const closed = closeTurn(dir)
      assert.equal(closed.status, "closed")
      assert.ok(closed.opened?.contextDigest)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
