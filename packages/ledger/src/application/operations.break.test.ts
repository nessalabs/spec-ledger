import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { initLedger } from "../cli/init.js"
import { sourceFingerprint } from "../evidence/fingerprint.js"
import { writeJson } from "../fs/load.js"
import { planRevision, recordAuthority } from "../permission/authority.js"
import { loadWorkstream } from "../workstream/load.js"
import { OperationError } from "./errors.js"
import { executeOperation, type OperationName } from "./operations.js"

const cliBin = new URL("../cli/main.js", import.meta.url)

function git(root: string, ...args: string[]): void {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
}

function fixture(options: { openTurn?: boolean; authorized?: boolean } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "sl-operations-break-"))
  git(root, "init", "-q")
  git(root, "config", "user.email", "fixture@example.test")
  git(root, "config", "user.name", "Fixture")
  initLedger(root, "operation boundary breaker")
  writeFileSync(join(root, "source.ts"), "export const behavior = true\n")
  writeJson(join(root, ".spec-ledger/workstreams/W-001.json"), {
    schemaVersion: 1,
    id: "W-001",
    status: "shaped",
    createdAt: "2026-09-05T00:00:00.000Z",
    title: "Operation boundary",
    problem: "Adapters must preserve lifecycle gates",
    objective: "Rejected operations have no domain effects",
    featureIds: ["alpha"],
    policy: { requireSpecBreak: false, requireCodeBreak: true },
    suggestedSlices: [{ id: "SLC-01", title: "Shared boundary", kind: "vertical", acceptance: ["Works"] }],
  })
  writeJson(join(root, ".spec-ledger/automation-events/AE-001.json"), {
    schemaVersion: 1,
    id: "AE-001",
    kind: "review-alert",
    state: "waiting",
    workstreamId: "W-001",
    openedAt: "2026-09-05T00:00:00.000Z",
    waitUntil: "2026-09-05T00:00:01.000Z",
    policySnapshot: { onAlertTimeout: "move" },
  })
  if (options.openTurn) {
    writeJson(join(root, ".spec-ledger/turns/T-001.json"), {
      schemaVersion: 1,
      id: "T-001",
      status: "open",
      openedAt: "2026-09-05T00:00:00.000Z",
      opened: { producedBy: "fixture", baseCommit: null, dirtyAtOpen: [] },
      intent: {
        userPrompt: "Exercise lifecycle operations",
        restatedGoal: "Preserve operation gates",
        workstreamId: "W-001",
        sliceId: "SLC-01",
        featureIds: ["alpha"],
      },
    })
  }
  git(root, "add", ".")
  git(root, "commit", "-qm", "fixture")
  if (options.authorized) {
    recordAuthority(root, {
      id: "AUTH-fixture",
      action: "grant",
      mode: "request",
      workstreamId: "W-001",
      featureIds: ["alpha"],
      source: { kind: "agent-reported", reference: "fixture authorization" },
    })
  }
  return root
}

function errorFrom(fn: () => unknown): OperationError {
  try {
    fn()
  } catch (error) {
    assert.ok(error instanceof OperationError, String(error))
    return error
  }
  assert.fail("operation unexpectedly succeeded")
}

function jsonFiles(path: string): string[] {
  return existsSync(path) ? readdirSync(path).filter((name) => name.endsWith(".json")) : []
}

function cliOperation(root: string, operation: OperationName, input: unknown) {
  const inputPath = join(tmpdir(), `sl-operation-input-${process.pid}-${Date.now()}.json`)
  writeFileSync(inputPath, JSON.stringify(input))
  try {
    const result = spawnSync(process.execPath, [cliBin.pathname, "operation", operation, "--file", inputPath, "--root", root], {
      encoding: "utf8",
    })
    return { status: result.status, output: JSON.parse(result.stdout) as Record<string, unknown>, stderr: result.stderr }
  } finally {
    rmSync(inputPath, { force: true })
  }
}

function revision(root: string): string {
  return planRevision(root, loadWorkstream(root, "W-001"))
}

function source(root: string): string {
  const digest = sourceFingerprint(root)
  assert.ok(digest)
  return digest
}

describe("shared operation boundary adversarial cases", () => {
  it("rejects an invalid slice through the actual CLI before sealing, opening, activating, or resuming", () => {
    const root = fixture({ authorized: true })
    try {
      const eventBefore = readFileSync(join(root, ".spec-ledger/automation-events/AE-001.json"), "utf8")
      const result = cliOperation(root, "begin_work", {
        requestId: "invalid-slice-req-0001",
        workstreamId: "W-001",
        sliceId: "SLC-does-not-exist",
        goal: "Must be rejected",
        expectedRevisionDigest: revision(root),
        allowDirty: true,
      })
      assert.equal(result.status, 1, result.stderr)
      assert.equal(result.output.ok, false)
      assert.equal((result.output.error as Record<string, unknown>).code, "invalid_input")
      assert.equal(loadWorkstream(root, "W-001").seal, undefined)
      assert.deepEqual(jsonFiles(join(root, ".spec-ledger/turns")), [])
      assert.deepEqual(jsonFiles(join(root, ".spec-ledger/deferral-activations")), [])
      assert.equal(readFileSync(join(root, ".spec-ledger/automation-events/AE-001.json"), "utf8"), eventBefore)
      assert.deepEqual(jsonFiles(join(root, ".spec-ledger/operations")), [])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("rejects a caller-supplied root field and cannot touch that checkout", () => {
    const root = fixture()
    const outside = mkdtempSync(join(tmpdir(), "sl-operations-outside-"))
    try {
      const marker = join(outside, "sentinel.txt")
      writeFileSync(marker, "unchanged")
      const result = cliOperation(root, "get_session", { workstreamId: "W-001", root: outside })
      assert.equal(result.status, 1, result.stderr)
      assert.equal((result.output.error as Record<string, unknown>).code, "invalid_input")
      assert.equal(readFileSync(marker, "utf8"), "unchanged")
      assert.deepEqual(readdirSync(outside), ["sentinel.txt"])
    } finally {
      rmSync(root, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  for (const operation of ["record_progress", "record_decision", "record_review"] as const) {
    it(`denies ${operation} without current permission and creates no domain record`, () => {
      const root = fixture({ openTurn: true })
      try {
        const common = {
          requestId: `denied-${operation.replace("record_", "")}-0001`,
          turnId: "T-001",
          expectedRevisionDigest: revision(root),
          expectedSourceDigest: source(root),
        }
        const input = operation === "record_progress" ? {
          ...common, summary: "Denied progress", criterionIds: ["SLC-01/AC-1"], implemented: true,
        } : operation === "record_decision" ? {
          ...common, decision: "Denied decision", rationale: "No permission exists",
        } : {
          ...common, target: "code", review: {
            kind: "adversarial", reviewer: "agent:fixture", verdict: "approve",
            summary: "Denied review", plainSummary: "This review must not be saved.", killersCited: ["fixture-killer"],
          },
        }
        const error = errorFrom(() => executeOperation(root, operation, input))
        assert.equal(error.code, "permission_denied")
        assert.deepEqual(jsonFiles(join(root, ".spec-ledger/decisions/T-001")), [])
        assert.deepEqual(jsonFiles(join(root, ".spec-ledger/reviews/turns/T-001")), [])
        assert.equal(loadWorkstream(root, "W-001").suggestedSlices?.[0].codeBreakReviewId, undefined)
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    })
  }

  it("stale revision and source inputs leave decisions and reviews unchanged", () => {
    const root = fixture({ openTurn: true, authorized: true })
    try {
      const staleRevision = errorFrom(() => executeOperation(root, "record_decision", {
        requestId: "stale-revision-req-0001",
        turnId: "T-001",
        decision: "Must remain stale",
        rationale: "The revision does not match",
        expectedRevisionDigest: "0".repeat(64),
        expectedSourceDigest: source(root),
      }))
      assert.equal(staleRevision.code, "revision_conflict")

      const staleSource = cliOperation(root, "record_review", {
        requestId: "stale-source-review-0001",
        target: "code",
        turnId: "T-001",
        expectedSourceDigest: "0".repeat(64),
        review: {
          kind: "adversarial", reviewer: "agent:fixture", verdict: "approve",
          summary: "Stale review", plainSummary: "A stale review must not be saved.", killersCited: ["fixture-killer"],
        },
      })
      assert.equal(staleSource.status, 1, staleSource.stderr)
      assert.equal((staleSource.output.error as Record<string, unknown>).code, "source_conflict")
      assert.deepEqual(jsonFiles(join(root, ".spec-ledger/decisions/T-001")), [])
      assert.deepEqual(jsonFiles(join(root, ".spec-ledger/reviews/turns/T-001")), [])
      assert.equal(loadWorkstream(root, "W-001").suggestedSlices?.[0].codeBreakReviewId, undefined)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("does not accept portable review fields that claim human provenance", () => {
    const root = fixture({ openTurn: true, authorized: true })
    try {
      const error = errorFrom(() => executeOperation(root, "record_review", {
        requestId: "forged-human-review-0001",
        target: "code",
        turnId: "T-001",
        expectedSourceDigest: source(root),
        review: {
          kind: "human",
          reviewer: "human:project-owner",
          verdict: "approve",
          summary: "Caller claims this came from the project owner.",
          plainSummary: "An agent string must not become verified human approval.",
          killersCited: ["caller-claimed-killer"],
        },
      }))
      assert.equal(error.code, "invalid_input")
      assert.deepEqual(jsonFiles(join(root, ".spec-ledger/reviews/turns/T-001")), [])
      assert.equal(loadWorkstream(root, "W-001").suggestedSlices?.[0].codeBreakReviewId, undefined)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("does not let a code review claim a workstream other than its turn", () => {
    const root = fixture({ openTurn: true, authorized: true })
    try {
      const error = errorFrom(() => executeOperation(root, "record_review", {
        requestId: "wrong-review-scope-0001",
        target: "code",
        turnId: "T-001",
        expectedSourceDigest: source(root),
        review: {
          workstreamId: "W-999",
          kind: "adversarial",
          reviewer: "agent:fixture",
          verdict: "approve",
          summary: "Caller supplied a different workstream.",
          plainSummary: "A review must stay attached to its actual workstream.",
          killersCited: ["scope-killer"],
        },
      }))
      assert.equal(error.code, "invalid_input")
      assert.deepEqual(jsonFiles(join(root, ".spec-ledger/reviews/turns/T-001")), [])
      assert.equal(loadWorkstream(root, "W-001").suggestedSlices?.[0].codeBreakReviewId, undefined)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("replaces a caller-supplied review tree digest with the current source digest", () => {
    const root = fixture({ openTurn: true, authorized: true })
    try {
      const current = source(root)
      const written = executeOperation(root, "record_review", {
        requestId: "forged-tree-review-0001",
        target: "code",
        turnId: "T-001",
        expectedSourceDigest: current,
        review: {
          workstreamId: "W-001",
          treeDigest: "0".repeat(64),
          kind: "adversarial",
          reviewer: "agent:fixture",
          verdict: "approve",
          summary: "The tool must stamp the reviewed source.",
          plainSummary: "The approval applies to the source the tool actually observed.",
          killersCited: ["tree-stamp-killer"],
        },
      }) as { treeDigest: string; workstreamId: string }
      assert.equal(written.workstreamId, "W-001")
      assert.equal(written.treeDigest, current)
      assert.notEqual(written.treeDigest, "0".repeat(64))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("rejects a different request that reuses an existing review ID and preserves the first review", () => {
    const root = fixture({ openTurn: true, authorized: true })
    try {
      const reviewPath = join(root, ".spec-ledger/reviews/turns/T-001/R-01.json")
      executeOperation(root, "record_review", {
        requestId: "first-review-write-0001",
        target: "code",
        turnId: "T-001",
        expectedSourceDigest: source(root),
        review: {
          id: "T-001/R-01",
          workstreamId: "W-001",
          kind: "adversarial",
          reviewer: "agent:first-reviewer",
          verdict: "approve",
          summary: "The first immutable review.",
          plainSummary: "The first review remains the review of record.",
          killersCited: ["first-review-killer"],
        },
      })
      const firstBytes = readFileSync(reviewPath, "utf8")

      const error = errorFrom(() => executeOperation(root, "record_review", {
        requestId: "second-review-write-0002",
        target: "code",
        turnId: "T-001",
        expectedSourceDigest: source(root),
        review: {
          id: "T-001/R-01",
          workstreamId: "W-001",
          kind: "adversarial",
          reviewer: "agent:second-reviewer",
          verdict: "request-changes",
          summary: "A conflicting replacement review.",
          plainSummary: "A later request must not replace the first review.",
          findings: [],
        },
      }))
      assert.equal(error.code, "idempotency_conflict")
      assert.equal(readFileSync(reviewPath, "utf8"), firstBytes)
      assert.equal(loadWorkstream(root, "W-001").suggestedSlices?.[0].codeBreakReviewId, "T-001/R-01")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
