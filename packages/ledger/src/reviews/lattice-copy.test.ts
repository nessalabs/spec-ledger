import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { initLedger } from "../cli/init.js"
import { auditLedger } from "../audit/audit.js"
import { writeReview } from "./load.js"
import {
  assertReviewLatticeCopy,
  latticeCopyProblems,
} from "./lattice-copy.js"
import type { Review } from "../types.js"

const base: Review = {
  schemaVersion: 1,
  id: "T-001/R-01",
  turnId: "T-001",
  kind: "adversarial",
  target: "code",
  reviewer: "agent:test",
  verdict: "comment",
  summary: "tech",
  plainSummary: "One Lattice sentence.",
}

describe("review Lattice copy", () => {
  it("rejects missing plainSummary and plainImpact", () => {
    assert.deepEqual(latticeCopyProblems({ ...base, plainSummary: "" }), [
      "plainSummary required (one Lattice sentence)",
    ])
    assert.deepEqual(
      latticeCopyProblems({
        ...base,
        findings: [
          {
            id: "F-01",
            severity: "high",
            gap: "tech gap",
          },
        ],
      }),
      ["finding F-01: plainImpact required"],
    )
    assert.doesNotThrow(() => assertReviewLatticeCopy(base))
  })

  it("writeReview refuses without Lattice copy", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-ledger-lattice-"))
    try {
      spawnSync("git", ["init"], { cwd: dir })
      initLedger(dir, "lattice")
      assert.throws(
        () =>
          writeReview(dir, {
            ...base,
            plainSummary: undefined,
          }),
        /plainSummary/,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("audit fails on review missing Lattice copy", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-ledger-audit-lattice-"))
    try {
      spawnSync("git", ["init"], { cwd: dir })
      initLedger(dir, "audit-lattice")
      const reviewsDir = join(dir, ".spec-ledger", "reviews", "turns", "T-001")
      mkdirSync(reviewsDir, { recursive: true })
      writeFileSync(
        join(reviewsDir, "R-01.json"),
        JSON.stringify({
          schemaVersion: 1,
          id: "T-001/R-01",
          turnId: "T-001",
          reviewer: "agent:x",
          verdict: "comment",
          summary: "tech only",
        }),
      )
      const report = auditLedger(dir)
      assert.equal(report.ok, false)
      assert.ok(
        report.findings.some((f) => f.rule === "review-missing-lattice-copy"),
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
