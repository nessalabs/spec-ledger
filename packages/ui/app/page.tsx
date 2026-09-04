import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nessalabs/ui"
import Link from "next/link"
import { ledgerSnapshot, serverClient } from "@/lib/ledger"
import { CompactTurnRow } from "@/components/compact-turn-row"
import { FreshnessBadge, TurnVerifyBadge } from "@/components/freshness-badge"
import { turnFreshness } from "@/lib/turns"
import type { Turn, Workstream } from "@nessalabs/spec-ledger-client"

export const dynamic = "force-dynamic"

export default async function OverviewPage() {
  const client = serverClient()
  const [snap, workstreams] = await Promise.all([
    ledgerSnapshot(),
    client.listWorkstreams(),
  ])
  const { report, turns } = snap

  const openTurn = turns.find((t) => t.status === "open") ?? null
  const liveWorkstreams = workstreams
    .filter((w) => w.status === "active" || w.status === "sealed")
    .sort((a, b) => b.id.localeCompare(a.id))
  const spotlight = liveWorkstreams[0] ?? null
  const latestCompleted = workstreams
    .filter((w) => w.status === "done")
    .sort((a, b) => b.id.localeCompare(a.id))[0] ?? null
  const recentTurns = turns
    .slice()
    .sort((a, b) =>
      (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt),
    )
    .slice(0, 6)
  const openFreshness = openTurn ? turnFreshness(openTurn, report) : "unknown"

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Spec Ledger</h1>
          <Badge variant={report.ok ? "default" : "destructive"}>
            verify {report.ok ? "OK" : "FAIL"}
          </Badge>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Read-only view of this checkout — active work, recent turns, and live
          verify.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Active workstream
        </h2>
        {spotlight ? (
          <WorkstreamCard workstream={spotlight} />
        ) : (
          <Card>
            <CardHeader className="gap-2">
              <CardTitle className="text-base">No active workstream</CardTitle>
              <CardDescription>
                {latestCompleted
                  ? "Latest sealed bet is done."
                  : "No sealed workstreams in this checkout yet."}
              </CardDescription>
            </CardHeader>
            {latestCompleted ? (
              <CardContent className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">Last completed</p>
                <Link
                  href={`/workstreams/${latestCompleted.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 no-underline hover:bg-muted/40"
                >
                  <span className="font-mono font-medium">{latestCompleted.id}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {latestCompleted.title}
                  </span>
                  <Badge variant="outline">done</Badge>
                </Link>
              </CardContent>
            ) : null}
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Open turn
        </h2>
        {openTurn ? (
          <OpenTurnCard turn={openTurn} freshness={openFreshness} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No open turn</CardTitle>
              <CardDescription>Nothing in flight in this checkout.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Recent turns
          </h2>
          <Link
            href="/turns"
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            All →
          </Link>
        </div>
        {recentTurns.length ? (
          <div className="flex flex-col gap-1.5">
            {recentTurns.map((t) => (
              <CompactTurnRow
                key={t.id}
                turn={t}
                report={report}
                workstreamTitle={
                  t.intent.workstreamId
                    ? workstreams.find((w) => w.id === t.intent.workstreamId)
                        ?.title
                    : null
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No turns yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Recent workstreams
          </h2>
          <Link
            href="/workstreams"
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            All →
          </Link>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {workstreams
            .slice()
            .sort((a, b) => b.id.localeCompare(a.id))
            .map((w) => (
              <li key={w.id}>
                <Link
                  href={`/workstreams/${w.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm no-underline hover:bg-muted/40"
                >
                  <span className="font-mono font-medium">{w.id}</span>
                  <span className="truncate text-muted-foreground">{w.title}</span>
                  <Badge variant="outline">{w.status}</Badge>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      <p className="font-mono text-[11px] text-muted-foreground">
        ledgerDigest {report.provenance.ledgerDigest.slice(0, 12)}… · commit{" "}
        {report.provenance.commit?.slice(0, 10) ?? "(none)"}
      </p>
    </div>
  )
}

function WorkstreamCard({ workstream }: { workstream: Workstream }) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/workstreams/${workstream.id}`}
            className="font-mono text-lg font-semibold no-underline hover:underline"
          >
            {workstream.id}
          </Link>
          <Badge variant="outline">{workstream.status}</Badge>
          {workstream.seal ? (
            <Badge variant="secondary" className="font-mono text-[10px]">
              seal rev {workstream.seal.revision}
            </Badge>
          ) : null}
        </div>
        <CardTitle className="text-base font-medium">{workstream.title}</CardTitle>
        <CardDescription className="text-sm text-foreground/80">
          {workstream.objective}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {(workstream.suggestedSlices ?? []).slice(0, 4).map((s) => (
          <Badge key={s.id} variant="outline" className="font-mono">
            {s.id}
          </Badge>
        ))}
        <Link
          href={`/workstreams/${workstream.id}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          Open workstream →
        </Link>
      </CardContent>
    </Card>
  )
}

function OpenTurnCard({
  turn,
  freshness,
}: {
  turn: Turn
  freshness: ReturnType<typeof turnFreshness>
}) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/turns/${turn.id}`}
            className="font-mono text-lg font-semibold no-underline hover:underline"
          >
            {turn.id}
          </Link>
          <Badge variant="secondary">open</Badge>
          <TurnVerifyBadge ok={turn.facts?.verify.ok} freshness={freshness} />
          <FreshnessBadge freshness={freshness} />
        </div>
        <CardDescription className="text-sm text-foreground">
          {turn.intent.restatedGoal}
        </CardDescription>
        {(turn.intent.workstreamId || turn.opened?.contextDigest) && (
          <p className="font-mono text-[11px] text-muted-foreground">
            {turn.intent.workstreamId}
            {turn.intent.sliceId ? ` / ${turn.intent.sliceId}` : ""}
            {turn.opened?.contextDigest
              ? ` · ctx ${turn.opened.contextDigest.slice(0, 12)}…`
              : ""}
          </p>
        )}
      </CardHeader>
    </Card>
  )
}
