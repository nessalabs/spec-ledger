import Link from "next/link"
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nessa-ui/react"
import { serverClient } from "@/lib/ledger"
import { TurnSummaryCard } from "@/components/turn-detail"

export const dynamic = "force-dynamic"

export default async function FeaturesPage() {
  const client = serverClient()
  const [graph, turns, report] = await Promise.all([
    client.getGraph(),
    client.getTurns(),
    client.verify(),
  ])
  const features = graph?.features ?? []

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Features
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Features</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Product capabilities. Each feature accumulates turn history when{" "}
          <code className="font-mono text-xs">turn close</code> maps files to it.
        </p>
      </header>

      {features.length === 0 ? (
        <p className="text-sm text-muted-foreground">No features in the graph.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {features.map((f) => {
            const history = turns.filter(
              (t) =>
                t.facts?.touchedFeatureIds.includes(f.id) ||
                t.intent.claimedFeatureIds?.includes(f.id),
            )
            return (
              <Card key={f.id}>
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/features/${encodeURIComponent(f.id)}`}
                      className="text-base font-semibold text-foreground no-underline hover:underline"
                    >
                      {f.name}
                    </Link>
                    <Badge variant="outline" className="font-mono">
                      {f.id}
                    </Badge>
                    <Badge variant="secondary">{history.length} turns</Badge>
                  </div>
                  <CardDescription>{f.summary}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      )}

      {turns.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Recent turns</h2>
          {turns
            .slice()
            .sort((a, b) =>
              (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt),
            )
            .slice(0, 3)
            .map((t) => (
              <TurnSummaryCard key={t.id} turn={t} report={report} />
            ))}
        </section>
      ) : null}
    </div>
  )
}
