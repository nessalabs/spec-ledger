import Link from "next/link"
import {
  Badge,
  Card,
  CardDescription,
  CardHeader,
} from "@nessalabs/ui"
import { liveReport, serverClient } from "@/lib/ledger"
import { TurnSummaryCard } from "@/components/turn-detail"

export const dynamic = "force-dynamic"

export default async function TurnsPage() {
  const client = serverClient()
  const [turns, report, events, workstreams] = await Promise.all([
    client.getTurns(),
    liveReport(),
    client.getAutomationEvents(),
    client.listWorkstreams(),
  ])
  const titles = new Map(workstreams.map((w) => [w.id, w.title]))
  const ordered = [...turns].sort((a, b) =>
    (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt),
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Turns
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">What changed</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Time feed of what changed. ⌘/Ctrl-click a row to peek beside the list;
          plain click opens the full turn.
        </p>
      </header>

      {events.length ? (
        <section className="space-y-2">
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Automation
          </h2>
          {events.map((e) => (
            <Card key={e.id}>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="font-mono">{e.id}</Badge>
                  <Badge variant="outline">{e.state}</Badge>
                  <Badge variant="secondary">{e.kind}</Badge>
                </div>
                <CardDescription>
                  {e.workstreamId ? (
                    <Link
                      href={`/workstreams/${encodeURIComponent(e.workstreamId)}`}
                      className="hover:underline"
                    >
                      {e.workstreamId}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {e.turnId ? (
                    <>
                      {" · "}
                      <Link
                        href={`/turns/${encodeURIComponent(e.turnId)}`}
                        className="hover:underline"
                      >
                        {e.turnId}
                      </Link>
                    </>
                  ) : null}
                  {e.note ? ` — ${e.note}` : ""}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      ) : null}

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No turns yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {ordered.map((turn) => (
            <TurnSummaryCard
              key={turn.id}
              turn={turn}
              report={report}
              compact
              workstreamTitle={
                turn.intent.workstreamId
                  ? titles.get(turn.intent.workstreamId)
                  : null
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
