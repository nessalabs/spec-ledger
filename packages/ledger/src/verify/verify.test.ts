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

    writeJson(join(dir, ".spec-ledger/claims/5e852279-c620-5042-b952-b015a4c32e20.json"), {
      id: "5e852279-c620-5042-b952-b015a4c32e20",
      kind: "invariant",
      statement: "DESIGN.md exists",
      required: true,
    })
    writeJson(join(dir, ".spec-ledger/claims/48cc88b5-b35b-5236-9e5b-b845d2319792.json"), {
      id: "48cc88b5-b35b-5236-9e5b-b845d2319792",
      kind: "invariant",
      statement: "unbound on purpose",
      required: true,
    })
    writeJson(join(dir, ".spec-ledger/bindings/96ea1d7d-215f-4981-8eef-9f9db6748504.json"), {
      id: "96ea1d7d-215f-4981-8eef-9f9db6748504",
      claimId: "5e852279-c620-5042-b952-b015a4c32e20",
      kind: "check",
      locator: { type: "path", path: "src/ok.ts" },
    })

    const report = verifyLedger(loadLedger(dir))
    assert.equal(report.ok, false)
    const sl1 = report.claims.find((c) => c.claimId === "5e852279-c620-5042-b952-b015a4c32e20")
    const sl2 = report.claims.find((c) => c.claimId === "48cc88b5-b35b-5236-9e5b-b845d2319792")
    assert.equal(sl1?.outcome, "pass")
    assert.equal(sl2?.outcome, "unbound")
    assert.ok(report.provenance.ledgerDigest.length === 64)
  })

  it("never treats attested as pass for required claims", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-ledger-"))
    initLedger(dir, "test")
    writeJson(join(dir, ".spec-ledger/claims/27d14c63-c79e-5cfc-b5dc-d27109c0b855.json"), {
      id: "27d14c63-c79e-5cfc-b5dc-d27109c0b855",
      kind: "absence",
      statement: "server has no write endpoints",
      required: true,
    })
    writeJson(join(dir, ".spec-ledger/bindings/7e861469-a23c-4511-b07e-4f3c1216ee0b.json"), {
      id: "7e861469-a23c-4511-b07e-4f3c1216ee0b",
      claimId: "27d14c63-c79e-5cfc-b5dc-d27109c0b855",
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
