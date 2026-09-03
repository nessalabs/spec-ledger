import Link from "next/link"
import { liveReport, serverClient } from "@/lib/ledger"
import { TurnSummaryCard } from "@/components/turn-detail"

export const dynamic = "force-dynamic"

export default async function FeaturesPage() {
  const client = serverClient()
  const [graph, turns, report] = await Promise.all([
    client.getGraph(),
    client.getTurns(),
    liveReport(),
  ])
  const features = graph?.features ?? []

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Features
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Capabilities</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Product surfaces in the graph. Open one for history; recent changes below.
        </p>
      </header>

      {features.length === 0 ? (
        <p className="text-sm text-muted-foreground">No features in the graph.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {features.map((f) => {
            const history = turns.filter(
              (t) =>
                t.facts?.touchedFeatureIds.includes(f.id) ||
                t.intent.claimedFeatureIds?.includes(f.id),
            )
            return (
              <li key={f.id}>
                <Link
                  href={`/features/${encodeURIComponent(f.id)}`}
                  className="grid gap-0.5 px-3 py-2 no-underline transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] sm:items-baseline sm:gap-3"
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {f.name}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {f.summary}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {f.id} · {history.length}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {turns.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Recent changes</h2>
          <div className="flex flex-col gap-1.5">
            {turns
              .slice()
              .sort((a, b) =>
                (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt),
              )
              .slice(0, 5)
              .map((t) => (
                <TurnSummaryCard key={t.id} turn={t} report={report} compact />
              ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
