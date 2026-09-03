import { serverClient } from "@/lib/ledger"
import { TurnSummaryCard } from "@/components/turn-detail"

export const dynamic = "force-dynamic"

export default async function TurnsPage() {
  const client = serverClient()
  const [turns, report] = await Promise.all([client.getTurns(), client.verify()])
  const ordered = [...turns].sort((a, b) =>
    (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt),
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Change log
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Turns</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A <strong className="font-medium text-foreground">turn</strong> is one intent →
          implementation unit. Humans/agents write intent;{" "}
          <code className="font-mono text-xs">spec-ledger turn close</code> writes facts
          (git + digests). Stale digests render as <em>unknown</em>, never as pass.
        </p>
      </header>

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No turns yet.{" "}
          <code className="font-mono text-xs">
            spec-ledger turn open --goal &quot;…&quot;
          </code>
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map((turn) => (
            <TurnSummaryCard key={turn.id} turn={turn} report={report} />
          ))}
        </div>
      )}
    </div>
  )
}
