import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { initLedger } from "../cli/init.js"
import { auditLedger } from "../audit/audit.js"
import {
  amendWorkstream,
  backfillDocDigest,
  checkSeal,
  sealWorkstream,
  writeWorkstream,
  loadWorkstream,
} from "./load.js"
import { sha256FileBytes } from "./doc-digest.js"

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "spec-doc-"))
  spawnSync("git", ["init", "-q"], { cwd: dir })
  initLedger(dir, "doc")
  mkdirSync(join(dir, "docs/workstreams"), { recursive: true })
  writeFileSync(join(dir, "docs/workstreams/bet.md"), "# bet v1\n", "utf8")
  const ws = {
    schemaVersion: 1 as const,
    id: "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a",
    status: "shaped" as const,
    createdAt: new Date().toISOString(),
    featureIds: ["cli"],
    title: "Bet",
    problem: "p",
    objective: "o",
    specPath: "docs/workstreams/bet.md",
    acceptanceCriteria: ["a"],
    suggestedSlices: [],
  }
  writeWorkstream(dir, ws)
  return dir
}

describe("sealed plan digests (7c0eb1c1-f6d3-5b70-941d-b485ee6a075d)", () => {
  it("seal stamps specDocDigest; check-seal fails on silent edit; amend restores", () => {
    const dir = repo()
    const sealed = sealWorkstream(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a", "human")
    assert.ok(sealed.seal?.specDocDigest)
    assert.equal(
      sealed.seal?.specDocDigest,
      sha256FileBytes(join(dir, "docs/workstreams/bet.md")),
    )
    assert.equal(checkSeal(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a").ok, true)

    writeFileSync(join(dir, "docs/workstreams/bet.md"), "# bet v2\n", "utf8")
    const drifted = checkSeal(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a")
    assert.equal(drifted.ok, false)
    assert.equal(drifted.doc?.status, "drift")

    const audit = auditLedger(dir)
    assert.ok(
      audit.findings.some((f) => f.rule === "spec-doc-digest-drift"),
      JSON.stringify(audit.findings),
    )

    const { amend } = amendWorkstream(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a", {
      by: "human",
      summary: "bump pitch to v2",
    })
    assert.notEqual(amend.beforeDocDigest, amend.afterDocDigest)
    assert.equal(checkSeal(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a").ok, true)
    assert.equal(auditLedger(dir).ok, true)
  })

  it("missing expected digest fails until backfill", () => {
    const dir = repo()
    const sealed = sealWorkstream(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a", "human")
    // Simulate pre-feature seal: strip digests
    const live = loadWorkstream(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a")
    assert.ok(live.seal)
    const { specDocDigest: _drop, ...restSeal } = live.seal
    live.seal = restSeal
    writeWorkstream(dir, live)
    // Also strip from snapshot
    const snapPath = join(dir, ".spec-ledger", sealed.seal!.snapshotPath)
    const snap = JSON.parse(readFileSync(snapPath, "utf8"))
    delete snap.specDocDigest
    writeFileSync(snapPath, JSON.stringify(snap, null, 2))

    const missing = checkSeal(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a")
    assert.equal(missing.ok, false)
    assert.equal(missing.doc?.status, "missing-expected")
    assert.ok(
      auditLedger(dir).findings.some((f) => f.rule === "spec-doc-digest-missing"),
    )

    const filled = backfillDocDigest(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a", "human")
    assert.ok(filled.seal?.specDocDigest)
    assert.equal(filled.seal!.revision, sealed.seal!.revision + 1)
    assert.equal(checkSeal(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a").ok, true)
  })

  it("amend refuses no-op and requires backfill first", () => {
    const dir = repo()
    sealWorkstream(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a", "human")
    assert.throws(
      () =>
        amendWorkstream(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a", {
          by: "human",
          summary: "noop",
        }),
      /no byte change/,
    )

    const live = loadWorkstream(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a")
    const { specDocDigest: _d, ...rest } = live.seal!
    live.seal = rest
    live.postSealAmends = []
    writeWorkstream(dir, live)
    assert.throws(
      () =>
        amendWorkstream(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a", {
          by: "human",
          summary: "x",
        }),
      /backfill-doc-digest/,
    )
  })

  it("seal-digest-drift when live payload diverges", () => {
    const dir = repo()
    sealWorkstream(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a", "human")
    const live = loadWorkstream(dir, "416a553f-8550-5a4b-b2ab-6bd5a3d58f2a")
    live.title = "changed without reseal"
    writeWorkstream(dir, live)
    const findings = auditLedger(dir).findings
    assert.ok(findings.some((f) => f.rule === "seal-digest-drift"))
  })
})
