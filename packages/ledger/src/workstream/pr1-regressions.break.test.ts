import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { initLedger } from "../cli/init.js"
import { auditLedger } from "../audit/audit.js"
import {
  amendWorkstream,
  checkSeal,
  loadWorkstream,
  sealWorkstream,
  writeWorkstream,
} from "./load.js"
import { sha256FileBytes } from "./doc-digest.js"

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "pr1-seal-regression-"))
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: dir }).status, 0)
  initLedger(dir, "seal-regression")
  mkdirSync(join(dir, "docs"))
  const doc = join(dir, "docs/spec.md")
  writeFileSync(doc, "v1\n")
  writeWorkstream(dir, {
    schemaVersion: 1,
    id: "W-100",
    status: "shaped",
    createdAt: new Date().toISOString(),
    featureIds: [],
    title: "Seal regression",
    problem: "Keep approved document bytes authoritative",
    objective: "Reject silent drift",
    specPath: "docs/spec.md",
    acceptanceCriteria: ["Document matches current seal and amendments"],
    suggestedSlices: [],
  })
  const firstSeal = sealWorkstream(dir, "W-100", "human")
  const snapshot = join(dir, ".spec-ledger", firstSeal.seal!.snapshotPath)
  return { dir, doc, snapshot }
}

function resealAfterAmendment(dir: string, doc: string) {
  writeFileSync(doc, "v2\n")
  const { amend } = amendWorkstream(dir, "W-100", {
    by: "human",
    summary: "Approve v2",
  })
  writeFileSync(doc, "v3\n")
  const resealed = sealWorkstream(dir, "W-100", "human")
  assert.equal(resealed.seal!.revision, 2)
  assert.deepEqual(resealed.postSealAmends, [amend], "Resealing preserves amendment history")
}

describe("PR #1 seal integrity regressions (T-025)", () => {
  it("resealing an amended document accepts the newly sealed bytes", (t) => {
    const { dir, doc } = fixture()
    t.after(() => rmSync(dir, { recursive: true, force: true }))
    resealAfterAmendment(dir, doc)
    assert.equal(checkSeal(dir, "W-100").ok, true, "The new seal must supersede prior-revision amendments")
    assert.equal(auditLedger(dir).ok, true)
  })

  it("reverting to a prior revision amendment fails both seal check and audit", (t) => {
    const { dir, doc } = fixture()
    t.after(() => rmSync(dir, { recursive: true, force: true }))
    resealAfterAmendment(dir, doc)
    writeFileSync(doc, "v2\n")
    const outcomes = {
      seal: checkSeal(dir, "W-100").ok,
      audit: auditLedger(dir).ok,
    }
    assert.deepEqual(outcomes, { seal: false, audit: false }, "An obsolete amendment cannot authorize reverting the newly sealed document")
  })

  it("a current amendment works after resealing but cannot hide a corrupted seal pointer", (t) => {
    const { dir, doc } = fixture()
    t.after(() => rmSync(dir, { recursive: true, force: true }))
    resealAfterAmendment(dir, doc)
    writeFileSync(doc, "v4\n")
    const { amend } = amendWorkstream(dir, "W-100", {
      by: "human",
      summary: "Approve v4 after the second seal",
    })
    assert.equal(amend.sealedRevision, 2)
    assert.equal(checkSeal(dir, "W-100").ok, true)
    assert.equal(auditLedger(dir).ok, true)
    const ws = loadWorkstream(dir, "W-100")
    ws.seal!.specDocDigest = sha256FileBytes(doc)
    writeWorkstream(dir, ws)
    assert.equal(checkSeal(dir, "W-100").ok, false, "An amendment must not mask mutation of its underlying seal digest")
    assert.equal(auditLedger(dir).ok, false)
  })

  for (const check of ["check-seal", "audit"] as const) {
    it(`${check} rejects rewriting only the live document digest`, (t) => {
      const { dir, doc, snapshot } = fixture()
      t.after(() => rmSync(dir, { recursive: true, force: true }))
      const originalSnapshot = readFileSync(snapshot)
      writeFileSync(doc, "Unrecorded obligations\n")
      const ws = loadWorkstream(dir, "W-100")
      ws.seal!.specDocDigest = sha256FileBytes(doc)
      writeWorkstream(dir, ws)
      assert.deepEqual(readFileSync(snapshot), originalSnapshot, "The immutable seal snapshot is untouched")
      const result = check === "check-seal" ? checkSeal(dir, "W-100") : auditLedger(dir)
      assert.equal(result.ok, false, "A changed live digest cannot replace the immutable seal without an amendment or reseal")
    })
  }
})
