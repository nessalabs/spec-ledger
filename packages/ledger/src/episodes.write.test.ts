import assert from "node:assert/strict"
import { mkdtempSync, rmSync, cpSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { spawnSync } from "node:child_process"
import { openTurn, closeTurn } from "./turns/close.js"
import { writeDecision, writeSource, writeProbe, writeFlow, writeAttachment } from "./episodes/write.js"
import { writeReview } from "./reviews/load.js"
import { episodeDigestsForTurn } from "./episodes/load.js"

const REPO = join(import.meta.dirname, "../../..")

test("episode write CLIs leave digests on close", () => {
  const dir = mkdtempSync(join(tmpdir(), "sl-ep-"))
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

    openTurn(
      dir,
      {
        userPrompt: "episode writes",
        restatedGoal: "Write side collections",
        workstreamId: "W-002",
        sliceId: "SLC-02",
        featureIds: ["turns"],
      },
      { workstreamId: "W-002", sliceId: "SLC-02", featureIds: ["turns"], allowDirty: true },
    )

    writeDecision(dir, {
      turnId: "T-001",
      decision: "Use JCS for digests",
      rationale: "Matches work-model",
      basis: { at: new Date().toISOString(), sealRevision: 1 },
    })
    writeSource(dir, { turnId: "T-001", kind: "doc", ref: "docs/architecture/work-model.md" })
    writeAttachment(dir, { turnId: "T-001", path: "docs/ci/github-actions.yml" })
    writeProbe(dir, { turnId: "T-001", question: "Does close stamp digests?", outcome: "yes" })
    writeFlow(dir, {
      turnId: "T-001",
      title: "close path",
      after: "flowchart TD; A-->B",
    })

    const digests = episodeDigestsForTurn(dir, "T-001")
    assert.ok(digests.decisionsDigest)
    assert.ok(digests.sourcesDigest)
    assert.ok(digests.attachmentsDigest)
    assert.ok(digests.probesDigest)
    assert.ok(digests.flowsDigest)

    writeReview(dir, {
      schemaVersion: 1,
      id: "T-001/R-01",
      turnId: "T-001",
      kind: "adversarial",
      target: "code",
      reviewer: "agent:test",
      verdict: "approve",
      summary: "ok",
      plainSummary: "Episode writes stamp digests on close.",
      killersCited: ["episode write"],
    })
    const closed = closeTurn(dir)
    assert.equal(closed.status, "closed")
    assert.ok(closed.facts?.decisionsDigest)
    assert.ok(closed.facts?.sourcesDigest)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
