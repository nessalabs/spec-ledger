import { spawnSync } from "node:child_process"
import { join } from "node:path"
import type { ClaimVerdict, LoadedLedger, Outcome, VerifyReport } from "../types.js"
import { pathExists, sha256Stable, writeJson } from "../fs/load.js"

const PRODUCED_BY = "@nessalabs/spec-ledger@0.1.0"

function gitCommit(repoRoot: string): string | null {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" })
  if (r.status !== 0) return null
  return r.stdout.trim() || null
}

function runCommand(repoRoot: string, command: string): { ok: boolean; detail: string } {
  const r = spawnSync(command, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true,
    env: process.env,
  })
  const detail = (r.stderr || r.stdout || "").trim().slice(0, 500)
  return { ok: r.status === 0, detail: detail || `exit ${r.status}` }
}

export function verifyLedger(ledger: LoadedLedger): VerifyReport {
  const problems: string[] = []
  const claimById = new Map(ledger.claims.map((c) => [c.id, c]))
  const bindingsByClaim = new Map<string, typeof ledger.bindings>()

  for (const b of ledger.bindings) {
    if (!claimById.has(b.claimId)) {
      problems.push(`dangling binding ${b.id}: claim ${b.claimId} does not exist`)
    }
    const list = bindingsByClaim.get(b.claimId) ?? []
    list.push(b)
    bindingsByClaim.set(b.claimId, list)
  }

  const resultsByKey = new Map(
    (ledger.results?.rows ?? []).map((row) => [row.key, row] as const),
  )

  const verdicts: ClaimVerdict[] = []

  for (const claim of ledger.claims) {
    if (claim.deprecated) continue
    const bindings = bindingsByClaim.get(claim.id) ?? []
    if (bindings.length === 0) {
      const outcome: Outcome = claim.required ? "unbound" : "missing"
      if (claim.required) problems.push(`required claim ${claim.id} has no bindings`)
      verdicts.push({
        claimId: claim.id,
        required: claim.required,
        outcome,
        bindingIds: [],
        detail: "no bindings",
      })
      continue
    }

    let outcome: Outcome = "missing"
    let detail: string | undefined
    const bindingIds = bindings.map((b) => b.id)

    for (const b of bindings) {
      if (b.locator.type === "results-row") {
        const key = b.locator.resultsKey ?? claim.id
        const row = resultsByKey.get(key)
        if (!row) {
          outcome = "missing"
          detail = `no results row for key ${key}`
          continue
        }
        outcome = row.outcome === "attested" ? "attested" : row.outcome
        detail = row.detail
        if (outcome === "fail") break
        if (outcome === "pass") break
      } else if (b.locator.type === "command" && b.locator.command) {
        const r = runCommand(ledger.repoRoot, b.locator.command)
        outcome = r.ok ? "pass" : "fail"
        detail = r.detail
        if (outcome === "fail") break
      } else if (b.locator.type === "path" && b.locator.path) {
        const ok = pathExists(ledger.repoRoot, b.locator.path)
        outcome = ok ? "pass" : "fail"
        detail = ok ? undefined : `missing path ${b.locator.path}`
        if (outcome === "fail") break
      } else if (b.locator.type === "attestation") {
        outcome = "attested"
        detail = b.locator.note ?? "attestation binding (never counts as pass)"
      }
    }

    if (claim.required && (outcome === "missing" || outcome === "fail")) {
      problems.push(`claim ${claim.id}: ${outcome}${detail ? ` — ${detail}` : ""}`)
    }
    // attested never auto-ok for required unless policy later says so — v1: required+attested is a problem
    if (claim.required && outcome === "attested") {
      problems.push(`claim ${claim.id}: attested (v1 policy: does not satisfy required)`)
    }

    verdicts.push({ claimId: claim.id, required: claim.required, outcome, bindingIds, detail })
  }

  const graphCheck = checkGraph(ledger)
  if (!graphCheck.ok) {
    for (const p of graphCheck.problems) problems.push(p)
  }

  const ledgerDigest = sha256Stable({
    config: ledger.config,
    claims: ledger.claims,
    bindings: ledger.bindings,
    graph: ledger.graph,
    policy: ledger.policy,
  })
  const resultsDigest = sha256Stable(ledger.results ?? { empty: true })

  const report: VerifyReport = {
    schemaVersion: 1,
    producedAt: new Date().toISOString(),
    producedBy: PRODUCED_BY,
    ok: problems.length === 0,
    provenance: {
      commit: gitCommit(ledger.repoRoot),
      ledgerDigest,
      resultsDigest,
      treeHint: ledger.repoRoot,
    },
    claims: verdicts,
    graph: {
      ok: graphCheck.ok,
      danglingNodes: graphCheck.danglingNodes,
      missingLocators: graphCheck.missingLocators,
      freshness: graphCheck.ok ? "ok" : "stale",
    },
    problems,
  }

  const reportPath = join(ledger.rootDir, ledger.config.reportPath ?? "results/report.json")
  writeJson(reportPath, report)
  return report
}

function checkGraph(ledger: LoadedLedger): {
  ok: boolean
  danglingNodes: string[]
  missingLocators: string[]
  problems: string[]
} {
  const problems: string[] = []
  const danglingNodes: string[] = []
  const missingLocators: string[] = []
  if (!ledger.graph) {
    return { ok: true, danglingNodes, missingLocators, problems }
  }

  const ids = new Set(ledger.graph.nodes.map((n) => n.id))
  for (const e of ledger.graph.edges) {
    if (!ids.has(e.from)) {
      danglingNodes.push(e.from)
      problems.push(`graph edge from unknown node ${e.from}`)
    }
    if (!ids.has(e.to)) {
      danglingNodes.push(e.to)
      problems.push(`graph edge to unknown node ${e.to}`)
    }
  }

  for (const n of ledger.graph.nodes) {
    if (n.locator && !pathExists(ledger.repoRoot, n.locator)) {
      missingLocators.push(n.locator)
      problems.push(`graph node ${n.id} locator missing on disk: ${n.locator}`)
    }
  }

  return { ok: problems.length === 0, danglingNodes, missingLocators, problems }
}
