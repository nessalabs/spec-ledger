import { resolveFeatureId, featureHref, featureSlug, featureLabel, featureSummary } from "@/lib/features"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
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
import { turnsTouchingFeature } from "@/lib/turns"

export const dynamic = "force-dynamic"

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = serverClient()
  const [graph, turns, report, claims] = await Promise.all([
    client.getGraph(),
    client.getTurns(),
    liveReport(),
    client.getClaims(),
  ])
  const feature = resolveFeatureId(graph?.features ?? [], id)
  if (!feature) notFound()
  if (id === "lattice" && !graph?.features.some(f => f.id === "spec-ledger-ui")) redirect(featureHref(feature.id))

  const history = turnsTouchingFeature(turns, feature.id)
  const nodes =
    graph?.nodes.filter((n) => n.featureIds?.includes(feature.id)) ?? []
  const linkedClaims = claims.filter((c) => feature.claimIds?.includes(c.id))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Link href="/features" className="no-underline hover:underline">
            Features
          </Link>
          {" / "}
          {featureSlug(feature.id)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{featureLabel(feature.id, feature.name)}</h1>
          <Badge variant="outline" className="font-mono">
            {featureSlug(feature.id)}
          </Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{featureSummary(feature.id, feature.summary)}</p>
      </header>

      {feature.keywords?.length ? (
        <div className="flex flex-wrap gap-2">
          {feature.keywords.map((k) => (
            <Badge key={k} variant="secondary">
              {feature.id === "lattice" ? k.replace(/\blattice\b/gi, "Spec Ledger UI") : k}
            </Badge>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Claims</CardTitle>
          <CardDescription>Standing truth this feature is bound to.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {linkedClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground">No claim links.</p>
          ) : (
            linkedClaims.map((c) => (
              <Link key={c.id} href={`/claims/${encodeURIComponent(c.id)}`}>
                <Badge className="font-mono">{c.id}</Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
          <CardDescription>Graph nodes tagged with this feature.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No modules tagged.</p>
          ) : (
            nodes.map((n) => (
              <Link
                key={n.id}
                href={`/nodes/${encodeURIComponent(n.id)}`}
                className="flex items-center gap-2 text-sm no-underline hover:underline"
              >
                <span className="font-mono font-medium">{n.id}</span>
                <span className="text-muted-foreground">{n.name ?? n.purpose}</span>
                <Badge variant="outline">{n.layer}</Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {feature.entryPoints?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Entry points</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="font-mono text-xs text-muted-foreground">
              {feature.entryPoints.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Turn history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No turns have touched this feature yet.
          </p>
        ) : (
          history.map((t) => <TurnSummaryCard key={t.id} turn={t} report={report} />)
        )}
      </section>
    </div>
  )
}
