import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nessa-ui/react"
import Link from "next/link"
import { serverClient } from "@/lib/ledger"
import { FreshnessBadge, TurnVerifyBadge } from "@/components/freshness-badge"
import { turnFreshness } from "@/lib/turns"
import type { Turn } from "@nessa/spec-ledger-client"

export const dynamic = "force-dynamic"

export default async function OverviewPage() {
  const client = serverClient()
  const [snap, workstreams] = await Promise.all([
    client.getSnapshot(),
    client.listWorkstreams(),
  ])
  const { report, turns } = snap

  const openTurn = turns.find((t) => t.status === "open") ?? null
  const activeBets = workstreams
    .filter((w) => w.status === "active" || w.status === "sealed" || w.status === "done")
    .sort((a, b) => b.id.localeCompare(a.id))
  const spotlight =
    activeBets.find((w) => w.status === "active" || w.status === "sealed") ??
    activeBets[0] ??
    null
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
          Bets → turns → verify. Read-only view of this checkout&apos;s ledger. Git
          and the CLI are the write path.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Active bet
        </h2>
        {spotlight ? (
          <Card>
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/workstreams/${spotlight.id}`}
                  className="font-mono text-lg font-semibold no-underline hover:underline"
                >
                  {spotlight.id}
                </Link>
                <Badge variant="outline">{spotlight.status}</Badge>
                {spotlight.seal ? (
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    seal rev {spotlight.seal.revision}
                  </Badge>
                ) : null}
              </div>
              <CardTitle className="text-base font-medium">{spotlight.title}</CardTitle>
              <CardDescription className="text-sm text-foreground/80">
                {spotlight.objective}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {(spotlight.suggestedSlices ?? []).slice(0, 4).map((s) => (
                <Badge key={s.id} variant="outline" className="font-mono">
                  {s.id}
                </Badge>
              ))}
              <Link
                href={`/workstreams/${spotlight.id}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                Open workstream →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">
            No sealed workstreams yet. Shape and seal a bet with the CLI.
          </p>
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
              <CardDescription>
                Start with{" "}
                <code className="font-mono text-xs">
                  spec-ledger turn open --workstream … --slice …
                </code>
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Workstreams
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
