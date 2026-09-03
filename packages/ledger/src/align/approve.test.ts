import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { assertAlignApproveValid, isAlignApproveReview } from "./approve.js"
import type { Review, Turn } from "../types.js"

const turn: Turn = {
  schemaVersion: 1,
  id: "T-100",
  status: "open",
  openedAt: "2026-01-01T00:00:00.000Z",
  opened: {
    producedBy: "@nessa/spec-ledger@0.1.0",
    baseCommit: "abc",
    dirtyAtOpen: [],
  },
  intent: {
    userPrompt: "x",
    restatedGoal: "x",
    changeType: "feature",
    riskLevel: "moderate",
  },
}

function baseReview(over: Partial<Review> = {}): Review {
  return {
    schemaVersion: 1,
    id: "T-100/R-01",
    turnId: "T-100",
    target: "code",
    kind: "human",
    reviewer: "agent:align",
    verdict: "approve",
    summary: "paths covered",
    treeDigest: "0123456789abcdef0123456789abcdef",
    uncoveredPaths: [],
    coverageSource: "graph",
    ...over,
  }
}

describe("align approve", () => {
  it("accepts valid align approve", () => {
    const review = baseReview()
    assert.equal(isAlignApproveReview(review, "agent:align"), true)
    assert.doesNotThrow(() =>
      assertAlignApproveValid({
        review,
        turn,
        policy: { alignReviewerPrefix: "agent:align" },
      }),
    )
  })

  it("refuses uncovered without waiverIds", () => {
    assert.throws(
      () =>
        assertAlignApproveValid({
          review: baseReview({ uncoveredPaths: ["packages/x.ts"] }),
          turn,
          policy: {},
        }),
      /waiverIds/,
    )
  })

  it("refuses wrong reviewer prefix", () => {
    assert.throws(
      () =>
        assertAlignApproveValid({
          review: baseReview({ reviewer: "agent:other" }),
          turn,
          policy: { alignReviewerPrefix: "agent:align" },
        }),
      /alignReviewerPrefix|must start with/,
    )
  })

  it("refuses reviewer equal to producer", () => {
    assert.throws(
      () =>
        assertAlignApproveValid({
          review: baseReview({ reviewer: "@nessa/spec-ledger@0.1.0" }),
          turn,
          policy: { alignReviewerPrefix: "@nessa" },
        }),
      /producer/,
    )
  })
})
