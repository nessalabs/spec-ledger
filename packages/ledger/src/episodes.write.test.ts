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
    // The copied ledger can trigger detached Git maintenance during commit.
    // Keep this disposable repository synchronous through its cleanup.
    spawnSync("git", ["config", "gc.auto", "0"], { cwd: dir })
    spawnSync("git", ["config", "maintenance.auto", "false"], { cwd: dir })
    spawnSync("git", ["add", "."], { cwd: dir })
    spawnSync("git", ["commit", "-m", "init"], { cwd: dir })

    const opened = openTurn(
      dir,
      {
        userPrompt: "episode writes",
        restatedGoal: "Write side collections",
        workstreamId: "e6213c3f-60e4-8ceb-9d6a-15c67833b383",
        sliceId: "b531f0e9-0768-8e61-821a-dd82767dff67",
        featureIds: ["turns"],
      },
      { workstreamId: "e6213c3f-60e4-8ceb-9d6a-15c67833b383", sliceId: "b531f0e9-0768-8e61-821a-dd82767dff67", featureIds: ["turns"], allowDirty: true },
    )

    writeDecision(dir, {
      turnId: opened.id,
      decision: "Use JCS for digests",
      rationale: "Matches work-model",
      basis: { at: new Date().toISOString(), sealRevision: 1 },
    })
    writeSource(dir, { turnId: opened.id, kind: "doc", ref: "docs/architecture/work-model.md" })
    writeAttachment(dir, { turnId: opened.id, path: "docs/ci/github-actions.yml" })
    writeProbe(dir, { turnId: opened.id, question: "Does close stamp digests?", outcome: "yes" })
    writeFlow(dir, {
      turnId: opened.id,
      title: "close path",
      after: "flowchart TD; A-->B",
    })

    const digests = episodeDigestsForTurn(dir, opened.id)
    assert.ok(digests.decisionsDigest)
    assert.ok(digests.sourcesDigest)
    assert.ok(digests.attachmentsDigest)
    assert.ok(digests.probesDigest)
    assert.ok(digests.flowsDigest)

    writeReview(dir, {
      schemaVersion: 1,
      id: "978fb18b-7dc9-520b-9fb5-0413b7b983bf",
      turnId: opened.id,
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
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})
