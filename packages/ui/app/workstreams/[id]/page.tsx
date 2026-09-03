import Link from "next/link"
import { notFound } from "next/navigation"
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

export default async function WorkstreamPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = serverClient()
  let ws
  try {
    ws = await client.getWorkstream(id)
  } catch {
    notFound()
  }
  const [turns, report] = await Promise.all([client.getTurns(), client.verify()])
  const linked = turns
    .filter(
      (t) =>
        t.intent.workstreamId === id ||
        t.intent.featureIds?.some((f) => ws.featureIds.includes(f)),
    )
    .sort((a, b) =>
      (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt),
    )

  const policy = (ws.policy ?? {}) as Record<string, unknown>

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Link href="/workstreams" className="no-underline hover:underline">
            Workstreams
          </Link>
          {" / "}
          {ws.id}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {ws.id}
          </h1>
          <Badge variant="outline">{ws.status}</Badge>
        </div>
        <h2 className="text-lg font-medium">{ws.title}</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{ws.objective}</p>
      </header>

      {ws.seal ? (
        <Card>
          <CardHeader>
            <CardTitle>Seal</CardTitle>
            <CardDescription>Immutable revision snapshot</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 font-mono text-xs sm:grid-cols-2">
            <Fact k="revision" v={String(ws.seal.revision)} />
            <Fact k="sealedBy" v={ws.seal.sealedBy} />
            <Fact k="specDigest" v={ws.seal.specDigest} />
            <Fact k="snapshot" v={ws.seal.snapshotPath} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Policy</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            requireCodeBreak: {String(policy.requireCodeBreak ?? true)}
          </Badge>
          <Badge variant="secondary">
            requireSpecBreak: {String(policy.requireSpecBreak ?? false)}
          </Badge>
          <Badge variant="outline">
            onAlert: {String(policy.onAlert ?? "—")}
          </Badge>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Slices</h2>
        {(ws.suggestedSlices ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No slices.</p>
        ) : (
          (ws.suggestedSlices ?? []).map((s) => (
            <Card key={s.id}>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{s.id}</span>
                  <Badge variant="outline">{s.kind}</Badge>
                </div>
                <CardTitle className="text-base font-medium">{s.title}</CardTitle>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {s.acceptance.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </CardHeader>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Turns</h2>
        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground">No turns linked yet.</p>
        ) : (
          linked.map((t) => <TurnSummaryCard key={t.id} turn={t} report={report} />)
        )}
      </section>
    </div>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex min-w-0 gap-2">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className="min-w-0 break-all">{v}</span>
    </div>
  )
}
