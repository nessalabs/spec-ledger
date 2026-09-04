import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot, loadLedger } from "../fs/load.js"
import { listAutomationEvents } from "../automation/load.js"
import { listAllReviews, listReviewsForTurn } from "../reviews/load.js"
import { latticeCopyProblems } from "../reviews/lattice-copy.js"
import { listWorkstreams, computeSpecDigest } from "../workstream/load.js"
import { checkSpecDocDigest } from "../workstream/doc-digest.js"
import { listAlignWaivers } from "../align/waiver.js"
import type { AuditFinding, AuditReport, LedgerRootConfig } from "../types.js"

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

export interface AuditPolicy {
  schemaVersion: 1
  failOn: Array<"error" | "warn">
  rules: {
    openTurnRequiresContextDigest?: boolean
    closedWorkstreamRequiresCodeBreak?: boolean
    blockedAutomationMustResolve?: boolean
    approveNeedsKillers?: boolean
    /** Fail when review JSON lacks Lattice plainSummary / finding plainImpact. */
    reviewsNeedLatticeCopy?: boolean
  }
}

const DEFAULT_POLICY: AuditPolicy = {
  schemaVersion: 1,
  failOn: ["error"],
  rules: {
    openTurnRequiresContextDigest: true,
    closedWorkstreamRequiresCodeBreak: true,
    blockedAutomationMustResolve: true,
    approveNeedsKillers: true,
    reviewsNeedLatticeCopy: true,
  },
}

export function loadAuditPolicy(repoRootInput: string): AuditPolicy {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const config = readJson<LedgerRootConfig>(join(rootDir, "ledger.json"))
  const path = join(rootDir, config.auditPolicyPath ?? "policy/audit.json")
  if (!existsSync(path)) return DEFAULT_POLICY
  const disk = readJson<AuditPolicy>(path)
  return {
    ...DEFAULT_POLICY,
    ...disk,
    rules: { ...DEFAULT_POLICY.rules, ...disk.rules },
  }
}

export function auditLedger(repoRootInput: string): AuditReport {
  const ledger = loadLedger(repoRootInput)
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const policy = loadAuditPolicy(repoRootInput)
  const findings: AuditFinding[] = []
  let n = 0
  const add = (
    severity: AuditFinding["severity"],
    rule: string,
    message: string,
    extra?: Partial<AuditFinding>,
  ) => {
    n += 1
    findings.push({
      id: `AF-${String(n).padStart(3, "0")}`,
      severity,
      rule,
      message,
      ...extra,
    })
  }

  for (const t of ledger.turns) {
    if (
      policy.rules.openTurnRequiresContextDigest &&
      t.status === "open" &&
      t.intent.workstreamId &&
      !t.opened?.contextDigest &&
      !t.opened?.noContextReason
    ) {
      add(
        "error",
        "builder-without-context",
        `open workstream turn ${t.id} lacks contextDigest`,
        { turnId: t.id, workstreamId: t.intent.workstreamId },
      )
    }

    if (
      policy.rules.closedWorkstreamRequiresCodeBreak &&
      t.status === "closed" &&
      t.intent.workstreamId
    ) {
      const reviews = listReviewsForTurn(repoRootInput, t.id)
      const ok = reviews.some(
        (r) =>
          r.verdict === "approve" &&
          Array.isArray(r.killersCited) &&
          r.killersCited.length > 0,
      )
      if (!ok) {
        add(
          "warn",
          "closed-without-code-break",
          `closed workstream turn ${t.id} has no approve+killers review on disk`,
          { turnId: t.id, workstreamId: t.intent.workstreamId },
        )
      }
    }

    if (policy.rules.approveNeedsKillers) {
      for (const r of listReviewsForTurn(repoRootInput, t.id)) {
        if (
          r.verdict === "approve" &&
          r.target !== "spec" &&
          !r.coverageSource &&
          (!r.killersCited || !r.killersCited.length)
        ) {
          add(
            "error",
            "approve-without-killers",
            `review ${r.id} approve lacks killersCited`,
            { turnId: t.id },
          )
        }
      }
    }
  }

  if (policy.rules.reviewsNeedLatticeCopy) {
    for (const r of listAllReviews(repoRootInput)) {
      const problems = latticeCopyProblems(r)
      if (!problems.length) continue
      add(
        "error",
        "review-missing-lattice-copy",
        `review ${r.id}: ${problems.join("; ")}`,
        { turnId: r.turnId, workstreamId: r.workstreamId },
      )
    }
  }

  for (const w of listAlignWaivers(repoRootInput)) {
    add(
      "info",
      "align-waiver",
      `align waiver ${w.id}: ${w.reason.slice(0, 80)}${w.reason.length > 80 ? "…" : ""}`,
      { turnId: w.turnId, workstreamId: w.workstreamId },
    )
  }

  if (policy.rules.blockedAutomationMustResolve) {
    for (const e of listAutomationEvents(repoRootInput)) {
      if (e.state === "blocked") {
        add(
          "error",
          "automation-event-blocked",
          `blocked automation ${e.id} unresolved`,
          { workstreamId: e.workstreamId, turnId: e.turnId },
        )
      }
    }
  }

  // Soft check: shaped workstreams without seal
  for (const ws of listWorkstreams(repoRootInput)) {
    if (ws.status === "shaped" && !ws.seal) {
      add(
        "info",
        "shaped-unsealed",
        `workstream ${ws.id} is shaped but not sealed`,
        { workstreamId: ws.id },
      )
    }
  }

  // Sealed plan digests (PC-019 / SLC-05)
  for (const ws of listWorkstreams(repoRootInput)) {
    if (!ws.seal) continue
    if (ws.specPath) {
      const doc = checkSpecDocDigest(repoRootInput, ws)
      if (!doc.ok && doc.status === "missing-expected") {
        add("error", "spec-doc-digest-missing", doc.message, {
          workstreamId: ws.id,
        })
      } else if (!doc.ok && doc.status === "drift") {
        add("error", "spec-doc-digest-drift", doc.message, {
          workstreamId: ws.id,
        })
      } else if (!doc.ok) {
        add("error", "spec-doc-digest-drift", doc.message, {
          workstreamId: ws.id,
        })
      }
    }
    const liveDigest = computeSpecDigest(ws)
    const snapPath = join(rootDir, ws.seal.snapshotPath)
    if (!existsSync(snapPath)) {
      add(
        "error",
        "seal-digest-drift",
        `workstream ${ws.id} seal snapshot missing: ${ws.seal.snapshotPath}`,
        { workstreamId: ws.id },
      )
      continue
    }
    const snap = readJson<{ specDigest?: string }>(snapPath)
    const snapDigest = snap.specDigest ?? ""
    // Compare live + pointer to the immutable snapshot digest — forging
    // seal.specDigest alone must not greenwash audit.
    if (
      liveDigest !== snapDigest ||
      ws.seal.specDigest !== snapDigest
    ) {
      add(
        "error",
        "seal-digest-drift",
        `workstream ${ws.id} live/pointer digest diverges from seal snapshot ${snapDigest.slice(0, 12) || "(missing)"}… without re-seal`,
        { workstreamId: ws.id },
      )
    }
  }

  const failSeverities = new Set(policy.failOn)
  const ok = !findings.some((f) => failSeverities.has(f.severity as "error" | "warn"))
  return {
    ok,
    producedAt: new Date().toISOString(),
    findings,
  }
}
