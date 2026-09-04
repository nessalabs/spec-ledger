// sl-dev-break killers (T-019 / SLC-04). Breaker-owned — builder fixes prod only.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { join } from "node:path"
import { checkPathCoverage } from "./coverage.js"
import {
  alignApproveSatisfied,
  assertAlignApproveValid,
  assertAlignCloseAllowed,
} from "./approve.js"
import type { CodebaseGraph, Review, Turn, Workstream } from "../types.js"

const REPO = join(import.meta.dirname, "../../../..")

const graph: CodebaseGraph = {
  system: { name: "t", description: "test", revision: "1" },
  layers: [],
  features: [],
  nodes: [
    {
      id: "ledger-core",
      name: "core",
      layer: "core",
      kind: "package",
      locator: "packages/ledger",
      featureIds: ["turns"],
    },
  ],
  edges: [],
}

const DIGEST = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

function turnWith(producedBy: string): Turn {
  return {
    schemaVersion: 1,
    id: "T-100",
    status: "open",
    openedAt: "2026-01-01T00:00:00.000Z",
    opened: { producedBy, baseCommit: "abc", dirtyAtOpen: [] },
    intent: {
      userPrompt: "x",
      restatedGoal: "x",
      workstreamId: "W-100",
    },
  }
}

function approve(over: Partial<Review> = {}): Review {
  return {
    schemaVersion: 1,
    id: "T-100/R-01",
    turnId: "T-100",
    target: "code",
    kind: "human",
    reviewer: "agent:align",
    verdict: "approve",
    summary: "align",
    plainSummary: "Sealed plan covers the product files in this turn.",
    treeDigest: DIGEST,
    uncoveredPaths: [],
    coverageSource: "graph",
    ...over,
  }
}

describe("KILLERS align/paths — poison input", () => {
  it("dot-dot segments must not smuggle paths into exempt or covered sets", () => {
    const r = checkPathCoverage({
      paths: [
        ".spec-ledger/../packages/rogue/evil.ts",
        "packages/ledger/../../secret.ts",
      ],
      featureIds: ["turns"],
      graph,
    })
    assert.deepEqual(
      r.coveredPaths,
      [],
      "traversal under a covered locator must not count as covered",
    )
    assert.equal(
      r.uncoveredPaths.length,
      2,
      `traversal under an exempt prefix must not vanish; got uncovered=${JSON.stringify(r.uncoveredPaths)}`,
    )
  })
})

describe("KILLERS align/approve — wrong principal / waiver binding", () => {
  it("approve with uncoveredPaths + waiverIds pointing at NO existing waiver must not satisfy", () => {
    const ok = alignApproveSatisfied({
      reviews: [
        approve({
          uncoveredPaths: ["packages/rogue/evil.ts"],
          waiverIds: ["T-100/AW-99"],
        }),
      ],
      waivers: [],
      treeDigest: DIGEST,
      policy: { requireAlignApprove: true, alignReviewerPrefix: "agent:align" },
      turnHasProductFiles: true,
    })
    assert.equal(ok, false, "bogus waiverIds satisfied the align gate")
  })

  it("close gate must refuse hand-written approve whose reviewer equals turn producer", () => {
    const turn = turnWith("agent:align-self")
    const ws = {
      schemaVersion: 1,
      id: "W-100",
      status: "sealed",
      title: "t",
      policy: { requireAlignApprove: true, alignReviewerPrefix: "agent:align" },
    } as unknown as Workstream
    assert.throws(
      () =>
        assertAlignCloseAllowed({
          turn,
          workstream: ws,
          reviews: [approve({ reviewer: "agent:align-self" })],
          treeDigest: DIGEST,
          productPathCount: 1,
          repoRoot: REPO,
        }),
      /producer|refused/,
    )
  })

  it("empty alignReviewerPrefix must not accept any reviewer", () => {
    assert.throws(
      () =>
        assertAlignApproveValid({
          review: approve({ reviewer: "agent:rogue" }),
          turn: turnWith("@nessalabs/spec-ledger@0.1.0"),
          policy: { alignReviewerPrefix: "" },
        }),
      /prefix|must start with/,
    )
  })
})
