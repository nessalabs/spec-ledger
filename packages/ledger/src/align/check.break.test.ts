// sl-dev-break killers (T-019 / SLC-04) — alignCheck + close gate in a real git fixture.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { alignCheck } from "./check.js"
import { assertTurnCloseAllowed } from "../turns/gates.js"
import { writeReview } from "../reviews/load.js"
import type { Turn } from "../types.js"

const REPO = join(import.meta.dirname, "../../../..")
const GARBAGE_DIGEST = "f".repeat(64)
const ROGUE = "packages/rogue/evil.ts"
const COVERED = "packages/ledger/src/turns/gates.ts"

function git(dir: string, args: string[]): string {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf8" })
  return (r.stdout || "").trim()
}

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "sl-align-killer-"))
  cpSync(join(REPO, ".spec-ledger"), join(dir, ".spec-ledger"), { recursive: true })
  // Keep sealed spec documents available so permission validation reaches the align gate.
  cpSync(join(REPO, "docs/workstreams"), join(dir, "docs/workstreams"), { recursive: true })
  for (const sub of ["turns", "align-waivers", "reviews/turns"]) {
    rmSync(join(dir, ".spec-ledger", sub), { recursive: true, force: true })
    mkdirSync(join(dir, ".spec-ledger", sub), { recursive: true })
  }
  git(dir, ["init", "-q"])
  git(dir, ["config", "user.email", "t@e.com"])
  git(dir, ["config", "user.name", "t"])
  return dir
}

function commitAll(dir: string, msg: string): string {
  git(dir, ["add", "-A"])
  git(dir, ["commit", "-q", "-m", msg])
  return git(dir, ["rev-parse", "HEAD"])
}

function writeProduct(dir: string, rel: string, body = "export const x = 1\n") {
  mkdirSync(join(dir, rel, ".."), { recursive: true })
  writeFileSync(join(dir, rel), body)
}

function writeTurn(dir: string, turn: Turn) {
  writeFileSync(
    join(dir, ".spec-ledger/turns", `${turn.id}.json`),
    JSON.stringify(turn, null, 2),
  )
}

function closedTurn(args: {
  baseCommit: string
  commit: string
  files: string[]
  treeDigest: string
}): Turn {
  return {
    schemaVersion: 1,
    id: "T-001",
    status: "closed",
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: "2026-01-01T01:00:00.000Z",
    opened: {
      producedBy: "@nessalabs/spec-ledger@0.1.0",
      baseCommit: args.baseCommit,
      dirtyAtOpen: [],
    },
    intent: {
      userPrompt: "k",
      restatedGoal: "k",
      workstreamId: "W-004",
      sliceId: "SLC-04",
      featureIds: ["turns"],
    },
    facts: {
      producedBy: "@nessalabs/spec-ledger@0.1.0",
      commit: args.commit,
      files: args.files.map((path) => ({ path, kind: "modified" as const })),
      touchedNodeIds: [],
      touchedFeatureIds: [],
      touchedClaimIds: [],
      blastRadius: { direct: [], transitive: [] },
      verify: {
        ok: true,
        ledgerDigest: "0".repeat(64),
        resultsDigest: "0".repeat(64),
        treeDigest: args.treeDigest,
      },
      schemaSurfaceChanged: false,
    },
  }
}

describe("KILLERS align/check — closed-turn blind spots (pnpm ledger:align / pre-push)", () => {
  it("new DIRTY uncovered product path after turn close must fail align check", () => {
    const dir = fixture()
    try {
      writeProduct(dir, COVERED)
      const base = commitAll(dir, "init")
      writeTurn(
        dir,
        closedTurn({ baseCommit: base, commit: base, files: [COVERED], treeDigest: GARBAGE_DIGEST }),
      )
      const head = commitAll(dir, "close turn")
      // No open turn. Attacker edits product outside any turn.
      writeProduct(dir, ROGUE)
      const report = alignCheck(dir)
      assert.equal(report.turnId, "T-001")
      assert.equal(
        report.ok,
        false,
        `dirty uncovered ${ROGUE} invisible; report=${report.message} (head ${head.slice(0, 7)})`,
      )
      assert.ok(report.coverage.uncoveredPaths.includes(ROGUE))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("COMMITTED uncovered product path after turn close (clean tree, CI) must fail align check", () => {
    const dir = fixture()
    try {
      writeProduct(dir, COVERED)
      const base = commitAll(dir, "init")
      writeTurn(
        dir,
        closedTurn({ baseCommit: base, commit: base, files: [COVERED], treeDigest: GARBAGE_DIGEST }),
      )
      commitAll(dir, "close turn")
      writeProduct(dir, ROGUE)
      commitAll(dir, "rogue product commit with no turn")
      const report = alignCheck(dir)
      assert.equal(
        report.ok,
        false,
        `committed uncovered ${ROGUE} invisible on clean tree; report=${report.message}`,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("post-close digest fallback must not accept a waiver whose treeDigest never matched any tree", () => {
    const dir = fixture()
    try {
      writeProduct(dir, ROGUE)
      const base = commitAll(dir, "init")
      const realDigest = "1".repeat(64)
      writeTurn(
        dir,
        closedTurn({ baseCommit: base, commit: base, files: [ROGUE], treeDigest: realDigest }),
      )
      writeFileSync(
        join(dir, ".spec-ledger/align-waivers/AW-01.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "T-001/AW-01",
            reason: "x".repeat(40),
            actor: "agent:anyone",
            treeDigest: GARBAGE_DIGEST,
            workstreamId: "W-004",
            turnId: "T-001",
            createdAt: "2026-01-01T02:00:00.000Z",
          },
          null,
          2,
        ),
      )
      commitAll(dir, "closed + waiver")
      const report = alignCheck(dir)
      assert.equal(
        report.ok,
        false,
        `garbage-digest waiver accepted via fallback; satisfiedBy=${report.satisfiedBy}`,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("KILLERS turns/gates — close gate bypass", () => {
  it("close must refuse when baseCommit is unresolvable and committed product paths are uncovered", () => {
    const dir = fixture()
    try {
      commitAll(dir, "init")
      const turn: Turn = {
        schemaVersion: 1,
        id: "T-001",
        status: "open",
        openedAt: "2026-01-01T00:00:00.000Z",
        opened: {
          producedBy: "@nessalabs/spec-ledger@0.1.0",
          // e.g. shallow CI clone / gc'd rebase — base no longer resolvable
          baseCommit: "0000000000000000000000000000000000000000",
          dirtyAtOpen: [],
        },
        intent: {
          userPrompt: "k",
          restatedGoal: "k",
          workstreamId: "W-004",
          sliceId: "SLC-04",
          featureIds: ["turns"],
        },
      }
      writeTurn(dir, turn)
      writeProduct(dir, ROGUE)
      commitAll(dir, "rogue committed under open turn")
      writeReview(dir, {
        schemaVersion: 1,
        id: "T-001/R-01",
        turnId: "T-001",
        kind: "adversarial",
        target: "code",
        reviewer: "agent:sl-dev-break",
        verdict: "approve",
        summary: "code-break ok",
        plainSummary: "Code-break killers passed for this fixture turn.",
        killersCited: ["x"],
      })
      assert.throws(
        () => assertTurnCloseAllowed(dir, turn),
        /requireAlignApprove/,
        "close gate skipped align because changedPathsSince fell back to dirty-only",
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
