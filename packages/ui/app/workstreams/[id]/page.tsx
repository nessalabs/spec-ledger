
import { ReadableText } from "@/components/readable-text"
import { GoalLinks } from "@/components/goal-links"
import { LiveWorkstreamEvidence } from "@/components/live-workstream-evidence"
import { presentationCopy } from "@/lib/features"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@nessalabs/ui"
import { liveReport, serverClient } from "@/lib/ledger"
import { readRepoMarkdown } from "@/lib/spec-md"
import { PitchDocLink } from "@/components/pitch-doc-link"
import { TurnDocSplit } from "@/components/turn-doc-split"
import { TurnSummaryCard } from "@/components/turn-detail"
import { workstreamFixups } from "@/lib/workstream-list"

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
  const [turns, report, projection] = await Promise.all([client.getTurns(), liveReport(), client.getSession(id)])
  const goals = await client.listGoals({ workstreamId: id })
  const linked = turns
    .filter((t) => t.intent.workstreamId === id)
    .sort((a, b) =>
      (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt),
    )
  const fixups = workstreamFixups(linked, id)

  const specPath =
    "specPath" in ws ? (ws as { specPath?: string }).specPath : undefined
  const planMarkdown = readRepoMarkdown(specPath)
  const statusLabel =
    ws.status === "done"
      ? projection.session?.completion.eligible ? "Complete" : "Completed earlier · needs attention"
      : ws.status === "active"
        ? "Active"
        : ws.status === "sealed"
          ? "Ready to start"
          : ws.status

  const docs =
    specPath && planMarkdown
      ? [{ path: specPath, label: presentationCopy(ws.title), content: planMarkdown }]
      : []

  const body = (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <Link href="/workstreams" className="no-underline hover:underline">
            Specs
          </Link>
          {" / "}
          <ReadableText>{presentationCopy(ws.title)}</ReadableText>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight"><ReadableText>{presentationCopy(ws.title)}</ReadableText></h1>
          <Badge variant="outline">{statusLabel}</Badge>
        </div>
        {ws.objective && <p className="max-w-2xl text-sm text-muted-foreground"><ReadableText>{presentationCopy(ws.objective)}</ReadableText></p>}
        <details className="max-w-2xl text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">
            Version details
            {ws.seal ? ` · sealed rev ${ws.seal.revision}` : " · unsealed"}
          </summary>
          <div className="mt-2 space-y-1 break-all rounded-md border border-border/60 px-3 py-2 font-mono">

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

      <GoalLinks goals={goals} />
      {specPath && planMarkdown ? (
        <PitchDocLink path={specPath} title="Read the spec" />
      ) : (
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          <ReadableText>{presentationCopy(ws.objective)}</ReadableText>
        </p>
      )}

      {fixups.length > 0 && <section aria-label="Spec fixups" className="space-y-2 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Fixups <span className="text-muted-foreground">· {fixups.length}</span></h2>
          <Link href="#changes" className="text-xs underline underline-offset-4">View change history</Link>
        </div>
        <ul className="space-y-2">
          {fixups.slice(0, 3).map(fixup => <li key={fixup.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <Link href={`/turns/${fixup.id}`} className="min-w-0 break-words underline underline-offset-4"><ReadableText>{fixup.intent.restatedGoal}</ReadableText></Link>
            <span className="text-xs text-muted-foreground">{fixup.status === "open" ? "In progress" : "Recorded"}</span>
          </li>)}
        </ul>
      </section>}

      {projection.session ? <LiveWorkstreamEvidence initial={projection} workstreamId={id} history={
      <section className="space-y-3">

        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Work history</h2>
          <p className="text-xs text-muted-foreground">
            {linked.length} turn{linked.length === 1 ? "" : "s"}
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
                workstreamTitle={presentationCopy(ws.title)}
              />
            ))}
          </div>
        )}
      </section>
      } /> :       <section className="space-y-3">

        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Work history</h2>
          <p className="text-xs text-muted-foreground">
            {linked.length} turn{linked.length === 1 ? "" : "s"}
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
                workstreamTitle={presentationCopy(ws.title)}
              />
            ))}
          </div>
        )}
      </section>}

    </div>
  )

  return docs.length ? <TurnDocSplit docs={docs}>{body}</TurnDocSplit> : body
}
