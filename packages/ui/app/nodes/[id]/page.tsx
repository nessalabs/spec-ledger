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
import { turnsTouchingNode } from "@/lib/turns"

export const dynamic = "force-dynamic"

export default async function NodePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = serverClient()
  const [graph, turns, report, impact, claims] = await Promise.all([
    client.getGraph(),
    client.getTurns(),
    liveReport(),
    client.impact(id).catch(() => ({ direct: [] as string[], transitive: [] as string[] })),
    client.getClaims(),
  ])
  const node = graph?.nodes.find((n) => n.id === id)
  if (!node) notFound()

  const edgesOut = graph?.edges.filter((e) => e.from === id) ?? []
  const edgesIn = graph?.edges.filter((e) => e.to === id) ?? []
  const history = turnsTouchingNode(turns, id)
  const linkedClaims = claims.filter(
    (c) => node.claimIds?.includes(c.id) || false,
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Link href="/graph" className="no-underline hover:underline">
            Graph
          </Link>
          {" / "}
          {node.id}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {node.name ?? node.id}
          </h1>
          <Badge variant="outline" className="font-mono">
            {node.id}
          </Badge>
          <Badge variant="secondary">{node.layer}</Badge>
          <Badge variant="outline">{node.kind}</Badge>
        </div>
        {node.purpose ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{node.purpose}</p>
        ) : null}
        {node.locator ? (
          <p className="font-mono text-xs text-muted-foreground">{node.locator}</p>
        ) : null}
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Depends on</CardTitle>
            <CardDescription>Outgoing edges</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {edgesOut.length === 0 ? (
              <p className="text-muted-foreground">None</p>
            ) : (
              edgesOut.map((e) => (
                <Link
                  key={`${e.from}-${e.to}-${e.kind}`}
                  href={`/nodes/${encodeURIComponent(e.to)}`}
                  className="font-mono no-underline hover:underline"
                >
                  {e.kind} → {e.to}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Used by</CardTitle>
            <CardDescription>Incoming edges</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {edgesIn.length === 0 ? (
              <p className="text-muted-foreground">None</p>
            ) : (
              edgesIn.map((e) => (
                <Link
                  key={`${e.from}-${e.to}-${e.kind}`}
                  href={`/nodes/${encodeURIComponent(e.from)}`}
                  className="font-mono no-underline hover:underline"
                >
                  {e.from} → {e.kind}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Blast radius</CardTitle>
          <CardDescription>
            Who breaks if this node changes — recomputed from the graph.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Direct
            </h3>
            <div className="flex flex-wrap gap-2">
              {impact.direct.length === 0 ? (
                <span className="text-sm text-muted-foreground">—</span>
              ) : (
                impact.direct.map((n) => (
                  <Link key={n} href={`/nodes/${encodeURIComponent(n)}`}>
                    <Badge variant="secondary" className="font-mono">
                      {n}
                    </Badge>
                  </Link>
                ))
              )}
            </div>
          </div>
          <div>
            <h3 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Transitive
            </h3>
            <div className="flex flex-wrap gap-2">
              {impact.transitive.length === 0 ? (
                <span className="text-sm text-muted-foreground">—</span>
              ) : (
                impact.transitive.map((n) => (
                  <Link key={n} href={`/nodes/${encodeURIComponent(n)}`}>
                    <Badge variant="outline" className="font-mono">
                      {n}
                    </Badge>
                  </Link>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {(node.featureIds?.length || linkedClaims.length) ? (
        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {node.featureIds?.map((f) => (
              <Link key={f} href={`/features/${encodeURIComponent(f)}`}>
                <Badge className="font-mono">{f}</Badge>
              </Link>
            ))}
            {linkedClaims.map((c) => (
              <Link key={c.id} href={`/claims/${encodeURIComponent(c.id)}`}>
                <Badge variant="secondary" className="font-mono">
                  {c.id}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Turn history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No closed turns list this node in facts.
          </p>
        ) : (
          history.map((t) => <TurnSummaryCard key={t.id} turn={t} report={report} />)
        )}
      </section>
    </div>
  )
}
