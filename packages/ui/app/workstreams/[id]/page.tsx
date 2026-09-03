import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@nessa-ui/react"
import { liveReport, serverClient } from "@/lib/ledger"
import { readRepoMarkdown } from "@/lib/spec-md"
import { PitchDocLink } from "@/components/pitch-doc-link"
import { TurnDocSplit } from "@/components/turn-doc-split"
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
  const [turns, report] = await Promise.all([client.getTurns(), liveReport()])
  const linked = turns
    .filter((t) => t.intent.workstreamId === id)
    .sort((a, b) =>
      (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt),
    )

  const specPath =
    "specPath" in ws ? (ws as { specPath?: string }).specPath : undefined
  const planMarkdown = readRepoMarkdown(specPath)
  const statusLabel =
    ws.status === "done"
      ? "Done"
      : ws.status === "active"
        ? "Active"
        : ws.status === "sealed"
          ? "Sealed"
          : ws.status

  const docs =
    specPath && planMarkdown
      ? [{ path: specPath, label: ws.title, content: planMarkdown }]
      : []

  const body = (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <Link href="/workstreams" className="no-underline hover:underline">
            Workstreams
          </Link>
          {" / "}
          {ws.id}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{ws.title}</h1>
          <Badge variant="outline">{statusLabel}</Badge>
        </div>
        <details className="max-w-2xl text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">
            Ledger notes
            {ws.seal ? ` · sealed rev ${ws.seal.revision}` : " · unsealed"}
          </summary>
          <div className="mt-2 space-y-1 rounded-md border border-border/60 px-3 py-2 font-mono">
            {ws.seal ? (
              <>
                <p>sealed by {ws.seal.sealedBy}</p>
                <p className="break-all">digest {ws.seal.specDigest.slice(0, 16)}…</p>
              </>
            ) : (
              <p>Not sealed yet.</p>
            )}
          </div>
        </details>
      </header>

      {specPath && planMarkdown ? (
        <PitchDocLink path={specPath} title="Sealed pitch" />
      ) : (
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {ws.objective}
        </p>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">What shipped</h2>
          <p className="text-xs text-muted-foreground">
            {linked.length} change{linked.length === 1 ? "" : "s"}
          </p>
        </div>
        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No turns under this workstream yet.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {linked.map((t) => (
              <TurnSummaryCard
                key={t.id}
                turn={t}
                report={report}
                compact
                workstreamTitle={ws.title}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )

  return docs.length ? <TurnDocSplit docs={docs}>{body}</TurnDocSplit> : body
}
