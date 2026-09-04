import type { Turn, VerifyReport } from "@nessalabs/spec-ledger-client"

export type DigestFreshness = "current" | "stale" | "unknown"

/** Compare a turn's closed digests to a fresh verify report. */
export function turnFreshness(
  turn: Turn,
  report: VerifyReport | null,
): DigestFreshness {
  if (!turn.facts || !report) return "unknown"
  const a = turn.facts.verify.ledgerDigest
  const b = report.provenance.ledgerDigest
  if (!a || !b) return "unknown"
  return a === b ? "current" : "stale"
}

export function latestClosedTurn(turns: Turn[]): Turn | null {
  const closed = turns
    .filter((t) => t.status === "closed" && t.facts)
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))
  return closed[0] ?? null
}

export function turnsTouchingFeature(turns: Turn[], featureId: string): Turn[] {
  return turns
    .filter(
      (t) =>
        t.facts?.touchedFeatureIds.includes(featureId) ||
        t.intent.claimedFeatureIds?.includes(featureId) ||
        t.intent.featureIds?.includes(featureId) ||
        t.intent.primaryFeatureId === featureId,
    )
    .sort((a, b) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt))
}

export function turnsTouchingClaim(turns: Turn[], claimId: string): Turn[] {
  return turns
    .filter(
      (t) =>
        t.facts?.touchedClaimIds.includes(claimId) ||
        t.intent.claimedClaimIds?.includes(claimId),
    )
    .sort((a, b) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt))
}

export function turnsTouchingNode(turns: Turn[], nodeId: string): Turn[] {
  return turns
    .filter((t) => t.facts?.touchedNodeIds.includes(nodeId))
    .sort((a, b) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt))
}
