"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { ReadableText, useRecordLabels } from "@/components/readable-text"
import { presentationCopy } from "@/lib/features"
import { readableText } from "@/lib/record-labels"
import { SPEC_VIEWS, specStageLabel, type SpecListRow, type SpecView } from "@/lib/workstream-list"
import { PeekLink, workstreamPeekMarkdown } from "@/components/peek-link"

const viewNames: Record<SpecView, string> = { active: "Active", all: "All", completed: "Completed", cancelled: "Cancelled" }
const emptyMessages: Record<SpecView, string> = { active: "No active specs. Completed and cancelled work is still available in the other views.", all: "No specs yet.", completed: "No completed specs yet.", cancelled: "No cancelled specs." }

export function WorkstreamsList({ rows, view, counts, page, pages, observedAt }: {
  rows: SpecListRow[]
  view: SpecView
  counts: Record<SpecView, number>
  page: number
  pages: number
  observedAt: string
}) {
  const labels = useRecordLabels()
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()

  return <section className="space-y-4" aria-label="Specs and progress" aria-busy={refreshing}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Spec filters" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {SPEC_VIEWS.map(item => <Link key={item} href={`/workstreams?view=${item}`} aria-current={view === item ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 text-sm no-underline ${view === item ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {viewNames[item]} <span className="tabular-nums">({counts[item]})</span>
        </Link>)}
      </nav>
      <button type="button" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
        {refreshing ? "Refreshing…" : "Refresh progress"}
      </button>
    </div>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-base font-semibold">{viewNames[view]} specs <span className="text-muted-foreground">· {counts[view]}</span></h2>
      <p role="status" className="text-xs text-muted-foreground">{refreshing ? "Refreshing the displayed snapshot…" : <><time dateTime={observedAt}>{new Date(observedAt).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })} UTC</time> · snapshot</>}</p>
    </div>
    {view === "active" && <p className="text-xs text-muted-foreground">Unfinished specs, including planned and ready work.</p>}
    {!rows.length ? <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{emptyMessages[view]}</p> :
      <ul className="divide-y divide-border rounded-lg border border-border">
        {rows.map(({ workstream: w, progress, latestFixup }) => {
          const blurb = w.objective?.trim() || w.problem
          const historical = w.status === "done"
          const percent = progress?.percent ?? null
          const cancelled = w.status === "cancelled"
          return <li key={w.id} className="p-4 sm:p-5">
            <PeekLink href={`/workstreams/${w.id}`} peekPath={`peek:workstream/${w.id}`} peekLabel={w.title}
              peekContent={workstreamPeekMarkdown({ labels, id: w.id, title: w.title, objective: blurb, status: w.status, revision: w.seal?.revision })}
              title="⌘/Ctrl-click to peek beside the list" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 no-underline hover:underline">
              <span className="min-w-0 break-words text-sm font-semibold"><ReadableText>{presentationCopy(w.title)}</ReadableText></span>
              <span className="shrink-0 text-xs text-muted-foreground">{specStageLabel(w.status)}</span>
            </PeekLink>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground"><ReadableText>{presentationCopy(blurb)}</ReadableText></p>
            {!cancelled && <div className="mt-3 space-y-1.5">
              <div className="flex flex-wrap justify-between gap-1 text-xs">
                <span>{historical ? "Current readiness" : "Work progress"}</span>
                <span className="tabular-nums">{percent === null ? "Progress unavailable" : `${progress!.done}/${progress!.total} complete · ${percent}%`}</span>
              </div>
              <div role="progressbar" aria-label={`${readableText(w.title, labels)} ${historical ? "current readiness" : "work progress"}`} aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={percent ?? undefined} aria-valuetext={percent === null ? "Progress is indeterminate" : `${progress!.done} of ${progress!.total} completion tasks complete`}
                className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${percent ?? 0}%` }} />
              </div>
              {historical && percent !== 100 && <p className="text-xs text-muted-foreground">Completed earlier; current work needs rechecking.</p>}
            </div>}
            {latestFixup && <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-border pt-3 text-xs">
              <span className="rounded border border-border px-1.5 py-0.5 font-medium">Fixup</span>
              <Link href={`/turns/${latestFixup.id}`} className="min-w-0 break-words underline underline-offset-4"><ReadableText>{latestFixup.title}</ReadableText></Link>
              <span className="text-muted-foreground">{latestFixup.status === "open" ? "In progress" : "Recorded"}</span>
            </div>}
          </li>
        })}
      </ul>}
    {pages > 1 && <nav aria-label="Spec pages" className="flex items-center justify-between gap-3 text-sm">
      {page > 1 ? <Link href={`/workstreams?view=${view}&page=${page - 1}`} className="underline">Previous</Link> : <span />}
      <span>Page {page} of {pages}</span>
      {page < pages ? <Link href={`/workstreams?view=${view}&page=${page + 1}`} className="underline">Next</Link> : <span />}
    </nav>}
  </section>
}
