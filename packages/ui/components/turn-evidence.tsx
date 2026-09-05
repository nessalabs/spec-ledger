'use client'
import type { SessionProjection, Turn } from '@nessalabs/spec-ledger-client'
import { useSessionObservation } from '@/components/use-session-observation'
import { WorkstreamEvidence } from '@/components/workstream-evidence'
import { evidenceForTurn } from '@/lib/turn-evidence'

export function TurnEvidence({ initial, turn }: { initial: SessionProjection; turn: Turn }) {
  const {data, state} = useSessionObservation(initial, turn.intent.workstreamId!)
  const session = data.session ?? initial.session
  if (!session) return <p>No evidence is available for this change.</p>
  const scoped = evidenceForTurn(session, turn)
  return <section className="space-y-4" aria-label="Evidence for this change">
    <p className="text-sm text-muted-foreground">Current checks for this change are shown below. Artifacts record what was observed during {turn.id}; they are not proof that later code still works.</p>
    {state === 'disconnected' && <p role="status">Disconnected · showing the last evidence observation.</p>}
    {!scoped.criteria.length && <p>No acceptance checks are mapped specifically to this change. This does not mean it was never implemented.</p>}
    <WorkstreamEvidence session={scoped} observedAt={data.observedAt} expandChecks />
  </section>
}
