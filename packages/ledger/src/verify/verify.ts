import { readFileSync } from "node:fs"
import { sourceFingerprint, checkFingerprint, localArtifactPath, contentHash } from "../evidence/fingerprint.js"
import { spawnSync } from "node:child_process"
import type { ClaimVerdict, LoadedLedger, Outcome, VerifyReport } from "../types.js"
import { pathExists, sha256Stable } from "../fs/load.js"

const PRODUCED_BY = "@nessalabs/spec-ledger@0.1.0"

function gitCommit(repoRoot: string): string | null {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" })
  if (r.status !== 0) return null
  return r.stdout.trim() || null
}

export function verifyLedger(ledger: LoadedLedger): VerifyReport {
  const problems: string[] = []
  const sourceDigest = sourceFingerprint(ledger.repoRoot, ledger.config.generatedArtifactPaths)
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

  const resultsByKey = new Map<string, NonNullable<LoadedLedger["results"]>["rows"][number]>()
  const duplicateKeys = new Set<string>()
  for (const row of ledger.results?.rows ?? []) {
    if (resultsByKey.has(row.key)) duplicateKeys.add(row.key)
    resultsByKey.set(row.key, row)
  }
  for (const key of [...duplicateKeys].sort()) problems.push(`duplicate results key ${key}`)

  const evaluateRow = (row: NonNullable<LoadedLedger["results"]>["rows"][number], claim: LoadedLedger["claims"][number], binding: LoadedLedger["bindings"][number]): {outcome: Outcome; detail?: string} => {
    if (!sourceDigest || !row.sourceDigest || !row.checkDigest) return {outcome:"missing",detail:"evidence freshness unknown; check requires source and check fingerprints"}
    if (row.sourceDigest !== sourceDigest || row.checkDigest !== checkFingerprint(claim,binding)) return {outcome:"missing",detail:"evidence is stale for the current source or check"}
    for (const artifact of row.artifacts ?? []) {
      if (!artifact.required) continue
      try {
        if (!artifact.path) throw new Error("required remote artifact has no locally observable copy")
        if (contentHash(readFileSync(localArtifactPath(ledger.repoRoot,artifact.path))) !== artifact.sha256) throw new Error("artifact hash mismatch")
      } catch { return {outcome:"missing",detail:"required evidence artifact is missing, inaccessible, or changed"} }
    }
    return {outcome:row.outcome,detail:row.detail}
  }

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

    const checks = bindings.map((b): { outcome: Outcome; detail?: string } => {
      if (b.locator.type === "results-row") {
        const key = b.locator.resultsKey ?? claim.id
        if (duplicateKeys.has(key)) return { outcome: "fail", detail: `duplicate results key ${key}` }
        const row = resultsByKey.get(key)
        if (!row) return { outcome: "missing", detail: `no results row for key ${key}` }
        if (!["pass", "fail", "missing", "attested"].includes(row.outcome)) {
          return { outcome: "missing", detail: `invalid outcome for key ${key}` }
        }
        return evaluateRow(row, claim, b)
      }
      if (b.locator.type === "command" && b.locator.command) {
        const key = `command:${b.id}`
        if (duplicateKeys.has(key)) return { outcome: "fail", detail: `duplicate results key ${key}` }
        const row = resultsByKey.get(key)
        return row && ["pass", "fail", "missing", "attested"].includes(row.outcome)
          ? evaluateRow(row, claim, b)
          : { outcome: "missing", detail: `command ${b.id} has no recorded result; run spec-ledger check` }
      }
      if (b.locator.type === "path" && b.locator.path) {
        const ok = pathExists(ledger.repoRoot, b.locator.path)
        return { outcome: ok ? "pass" : "fail", detail: ok ? undefined : `missing path ${b.locator.path}` }
      }
      if (b.locator.type === "attestation") {
        return { outcome: "attested", detail: b.locator.note ?? "attestation binding (never counts as pass)" }
      }
      return { outcome: "missing", detail: `binding ${b.id} has no usable locator` }
    })
    const rank: Record<Outcome, number> = { pass: 0, attested: 1, missing: 2, unbound: 2, fail: 3 }
    const outcome = checks.reduce<Outcome>((worst, check) =>
      rank[check.outcome] > rank[worst] ? check.outcome : worst, "pass")
    const detail = checks.map((check, i) => check.outcome !== "pass"
      ? `${bindings[i].id}: ${check.detail ?? check.outcome}` : undefined)
      .filter(Boolean).sort().join("; ") || undefined
    const bindingIds = bindings.map((b) => b.id)

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
      sourceDigest,
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
