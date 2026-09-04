import { featureHref, featureLabel } from "@/lib/features"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nessalabs/ui"
import { liveReport, serverClient } from "@/lib/ledger"
import { TurnSummaryCard } from "@/components/turn-detail"
import { turnsTouchingClaim } from "@/lib/turns"

export const dynamic = "force-dynamic"

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = serverClient()
  const [claims, bindings, turns, report, graph] = await Promise.all([
    client.getClaims(),
    client.getBindings(),
    client.getTurns(),
    liveReport(),
    client.getGraph(),
  ])
  const claim = claims.find((c) => c.id === id)
  if (!claim) notFound()

  const claimBindings = bindings.filter((b) => b.claimId === id)
  const verdict = report.claims.find((c) => c.claimId === id)
  const history = turnsTouchingClaim(turns, id)
  const features =
    graph?.features.filter((f) => f.claimIds?.includes(id)) ?? []

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Link href="/claims" className="no-underline hover:underline">
            Claims
          </Link>
          {" / "}
          {claim.id}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {claim.id}
          </h1>
          <Badge variant="outline">{claim.kind}</Badge>
          {claim.required ? <Badge>required</Badge> : null}
          {verdict ? (
            <Badge
              variant={
                verdict.outcome === "pass"
                  ? "default"
                  : verdict.outcome === "fail"
                    ? "destructive"
                    : "outline"
              }
            >
              {verdict.outcome}
            </Badge>
          ) : null}
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {claim.statement}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Bindings</CardTitle>
          <CardDescription>How we intend to check this claim — no status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-xs">
          {claimBindings.length === 0 ? (
            <p className="text-muted-foreground">No bindings</p>
          ) : (
            claimBindings.map((b) => (
              <div key={b.id} className="rounded-md border border-border px-3 py-2">
                <span className="text-foreground">{b.id}</span> · {b.kind} ·{" "}
                {b.locator.type}
                {b.locator.path ? ` · ${b.locator.path}` : ""}
                {b.locator.command ? ` · ${b.locator.command}` : ""}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {features.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {features.map((f) => (
              <Link key={f.id} href={featureHref(f.id, graph?.features)}>
                <Badge className="font-mono">{featureLabel(f.id, f.name)}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Turns that touched this claim</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          history.map((t) => <TurnSummaryCard key={t.id} turn={t} report={report} />)
        )}
      </section>
    </div>
  )
}
