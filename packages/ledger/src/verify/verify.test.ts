import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { initLedger } from "../cli/init.js"
import { loadLedger, writeJson } from "../fs/load.js"
import { verifyLedger } from "../verify/verify.js"
import { blastRadius } from "../graph/impact.js"

describe("spec-ledger verify", () => {
  it("fails required unbound claims and passes path bindings", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-ledger-"))
    initLedger(dir, "test")
    mkdirSync(join(dir, "src"), { recursive: true })
    writeFileSync(join(dir, "src", "ok.ts"), "export {}\n")

    writeJson(join(dir, ".spec-ledger/claims/SL-001.json"), {
      id: "SL-001",
      kind: "invariant",
      statement: "DESIGN.md exists",
      required: true,
    })
    writeJson(join(dir, ".spec-ledger/claims/SL-002.json"), {
      id: "SL-002",
      kind: "invariant",
      statement: "unbound on purpose",
      required: true,
    })
    writeJson(join(dir, ".spec-ledger/bindings/b1.json"), {
      id: "b1",
      claimId: "SL-001",
      kind: "check",
      locator: { type: "path", path: "src/ok.ts" },
    })

    const report = verifyLedger(loadLedger(dir))
    assert.equal(report.ok, false)
    const sl1 = report.claims.find((c) => c.claimId === "SL-001")
    const sl2 = report.claims.find((c) => c.claimId === "SL-002")
    assert.equal(sl1?.outcome, "pass")
    assert.equal(sl2?.outcome, "unbound")
    assert.ok(report.provenance.ledgerDigest.length === 64)
  })

  it("never treats attested as pass for required claims", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-ledger-"))
    initLedger(dir, "test")
    writeJson(join(dir, ".spec-ledger/claims/SL-010.json"), {
      id: "SL-010",
      kind: "absence",
      statement: "server has no write endpoints",
      required: true,
    })
    writeJson(join(dir, ".spec-ledger/bindings/att.json"), {
      id: "att",
      claimId: "SL-010",
      kind: "attestation",
      locator: { type: "attestation", note: "reviewed in DESIGN.md" },
    })
    const report = verifyLedger(loadLedger(dir))
    assert.equal(report.ok, false)
    assert.equal(report.claims[0]?.outcome, "attested")
  })

  it("computes blast radius from reverse edges", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-ledger-"))
    initLedger(dir, "test")
    writeJson(join(dir, ".spec-ledger/graph/codebase-graph.json"), {
      system: { name: "t", description: "", revision: "0" },
      layers: [{ id: "core", name: "Core" }],
      features: [],
      nodes: [
        { id: "a", layer: "core", kind: "module" },
        { id: "b", layer: "core", kind: "module" },
        { id: "c", layer: "core", kind: "module" },
      ],
      edges: [
        { from: "b", to: "a", kind: "calls" },
        { from: "c", to: "b", kind: "calls" },
      ],
    })
    const g = loadLedger(dir).graph!
    const r = blastRadius(g, "a")
    assert.deepEqual(r.direct, ["b"])
    assert.deepEqual(r.transitive, ["b", "c"])
  })
})
