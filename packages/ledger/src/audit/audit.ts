import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot, loadLedger } from "../fs/load.js"
import { listAutomationEvents } from "../automation/load.js"
import { listReviewsForTurn } from "../reviews/load.js"
import { listWorkstreams } from "../workstream/load.js"
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
  },
}

export function loadAuditPolicy(repoRootInput: string): AuditPolicy {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const config = readJson<LedgerRootConfig>(join(rootDir, "ledger.json"))
  const path = join(rootDir, config.auditPolicyPath ?? "policy/audit.json")
  if (!existsSync(path)) return DEFAULT_POLICY
  return { ...DEFAULT_POLICY, ...readJson<AuditPolicy>(path) }
}

export function auditLedger(repoRootInput: string): AuditReport {
  const ledger = loadLedger(repoRootInput)
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

  const failSeverities = new Set(policy.failOn)
  const ok = !findings.some((f) => failSeverities.has(f.severity as "error" | "warn"))
  return {
    ok,
    producedAt: new Date().toISOString(),
    findings,
  }
}
