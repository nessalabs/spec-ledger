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
    assert.match(opened.id, /^[0-9a-f-]{36}$/)

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
      { path: ".spec-ledger/claims/5e852279-c620-5042-b952-b015a4c32e20.json", kind: "added" },
    ])
    assert.ok(derived.touchedClaimIds.includes("5e852279-c620-5042-b952-b015a4c32e20"))
  })

  it("workstream open stamps contextDigest; unsealed refused", () => {
    const dir = mkdtempSync(join(tmpdir(), "sl-open-ctx-"))
    try {
      cpSync(join(REPO, ".spec-ledger"), join(dir, ".spec-ledger"), { recursive: true })
      cpSync(join(REPO, "docs"), join(dir, "docs"), { recursive: true })
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
          workstreamId: "3317ada5-b347-894e-8c88-110b7b42d58b",
          sliceId: "bec491ff-a422-808c-b304-89a166f5e466",
          featureIds: ["turns"],
        },
        { workstreamId: "3317ada5-b347-894e-8c88-110b7b42d58b", sliceId: "bec491ff-a422-808c-b304-89a166f5e466", featureIds: ["turns"], allowDirty: true },
      )
      assert.equal(opened.opened?.contextWorkstreamId, "3317ada5-b347-894e-8c88-110b7b42d58b")
      assert.equal(opened.opened?.contextSliceId, "bec491ff-a422-808c-b304-89a166f5e466")
      assert.equal(opened.opened?.contextDigest?.length, 64)
      assert.equal(opened.opened?.treeDigest?.length, 64)

      // close needs code-break; abandon by deleting for next fixture step
      rmSync(join(dir, ".spec-ledger/turns", `${opened.id}.json`))

      const wsPath = join(dir, ".spec-ledger/workstreams/3317ada5-b347-894e-8c88-110b7b42d58b.json")
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
              workstreamId: "3317ada5-b347-894e-8c88-110b7b42d58b",
              sliceId: "bec491ff-a422-808c-b304-89a166f5e466",
            },
            { workstreamId: "3317ada5-b347-894e-8c88-110b7b42d58b", sliceId: "bec491ff-a422-808c-b304-89a166f5e466", allowDirty: true },
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
      cpSync(join(REPO, "docs"), join(dir, "docs"), { recursive: true })
      // Avoid colliding with copied open/closed turns
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
          userPrompt: "gate close",
          restatedGoal: "Require code break",
          workstreamId: "3317ada5-b347-894e-8c88-110b7b42d58b",
          sliceId: "bec491ff-a422-808c-b304-89a166f5e466",
          featureIds: ["turns"],
        },
        { workstreamId: "3317ada5-b347-894e-8c88-110b7b42d58b", sliceId: "bec491ff-a422-808c-b304-89a166f5e466", featureIds: ["turns"], allowDirty: true },
      )

      assert.throws(() => closeTurn(dir), /requireCodeBreak/)

      writeReview(dir, {
        schemaVersion: 1,
        id: "978fb18b-7dc9-520b-9fb5-0413b7b983bf",
        turnId: opened.id,
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
        id: "c3c1d77f-ef8b-5a5c-914d-b9dd795a9654",
        turnId: opened.id,
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
