import type { SessionProjection, Turn } from '@nessalabs/spec-ledger-client'
type Session = NonNullable<SessionProjection['session']>

/** Scope current checks without attributing a whole workstream's proof to one change. */
export function evidenceForTurn(session: Session, turn: Turn): Session {
  const claimIds = new Set(turn.intent.claimedClaimIds ?? [])
  const criteria = session.criteria.filter(c => turn.intent.sliceId
    ? c.id.startsWith(`${turn.intent.sliceId}/`)
    : c.claims.some(claim => claimIds.has(claim.id)))
  return { ...session, criteria, evidenceCount: criteria.filter(c => c.evidence === 'pass').length,
    reviews: session.reviews.filter(r => r.turnId === turn.id),
    artifacts: session.artifacts.filter(a => a.turnId === turn.id) }
}

export function completionLabel(status: string, eligible: boolean) {
  return status === 'done' ? eligible ? 'Completed · current checks satisfied' : 'Completed earlier · current verification needs attention' : null
}
