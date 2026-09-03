import {
  Badge,
  Card,
  CardDescription,
  CardHeader,
} from "@nessa-ui/react"
import Link from "next/link"
import { serverClient } from "@/lib/ledger"
import { TurnSummaryCard } from "@/components/turn-detail"

export const dynamic = "force-dynamic"

export default async function TimelinePage() {
  const client = serverClient()
  const [turns, report, events] = await Promise.all([
    client.getTurns(),
    client.verify(),
    client.getAutomationEvents(),
  ])
  const ordered = [...turns].sort((a, b) =>
    (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt),
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Timeline
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Episode history</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Closed and open turns in time order, plus automation interrupts.
        </p>
      </header>

      {events.length ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Automation</h2>
          {events.map((e) => (
            <Card key={e.id}>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="font-mono">{e.id}</Badge>
                  <Badge variant="outline">{e.state}</Badge>
                  <Badge variant="secondary">{e.kind}</Badge>
                </div>
                <CardDescription>
                  {e.workstreamId ?? "—"}
                  {e.turnId ? ` · ${e.turnId}` : ""}
                  {e.note ? ` — ${e.note}` : ""}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Turns</h2>
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No turns yet.</p>
        ) : (
          ordered.map((t) => (
            <div key={t.id} className="space-y-1">
              <TurnSummaryCard turn={t} report={report} />
              {t.intent.workstreamId ? (
                <p className="px-1 font-mono text-[11px] text-muted-foreground">
                  <Link
                    href={`/features/${encodeURIComponent(t.intent.primaryFeatureId ?? t.intent.featureIds?.[0] ?? "turns")}`}
                    className="hover:underline"
                  >
                    {t.intent.workstreamId}
                    {t.intent.sliceId ? ` / ${t.intent.sliceId}` : ""}
                  </Link>
                </p>
              ) : null}
            </div>
          ))
        )}
      </section>
    </div>
  )
}
