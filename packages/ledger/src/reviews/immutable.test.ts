import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { initLedger } from "../cli/init.js"
import { listReviewsForTurn, writeReview } from "./load.js"
import type { Review } from "../types.js"

test("turn review IDs are immutable", () => {
  const root = mkdtempSync(join(tmpdir(), "sl-review-immutable-"))
  try {
    assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0)
    initLedger(root, "immutable reviews")
    const original: Review = {
      schemaVersion: 1,
      id: "T-001/R-01",
      turnId: "T-001",
      kind: "adversarial",
      target: "code",
      reviewer: "agent:breaker",
      verdict: "comment",
      summary: "Original immutable review",
      plainSummary: "The original review remains available.",
    }
    writeReview(root, original)
    assert.throws(
      () => writeReview(root, { ...original, reviewer: "agent:other", summary: "Conflicting replacement" }),
      /review id already exists/,
    )
    const [stored] = listReviewsForTurn(root, "T-001")
    assert.equal(stored?.reviewer, original.reviewer)
    assert.equal(stored?.summary, original.summary)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
