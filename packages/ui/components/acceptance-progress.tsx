
import { ReadableText } from "@/components/readable-text"
import { acceptanceProgress, completionProgress } from "@/lib/acceptance-progress"
import { Check, CircleDashed, Loader } from "lucide-react"
import type { CompletionChecklistItem } from "@nessalabs/spec-ledger-client"

// Keep completed and pending gates in the same workflow order.
const checklistOrder: Record<string, number> = {
  permission: -1,
  seal: 0,
  'spec-review': 1,
  criteria: 2,
  'code-review': 3,
  'review-findings': 4,
  deferrals: 5,
  screenshots: 6,
  workflow: 7,
  turn: 8,
}

/** Done, actively moving, or not started — never a stand-in for a passing check. */
function ChecklistMark({ state }: { state: CompletionChecklistItem["state"] }) {
  if (state === "done") {
    return <Check className="size-4 shrink-0 translate-y-0.5 text-emerald-600 dark:text-emerald-400" aria-label="Done" />
  }
  if (state === "in-progress") {
    return <Loader className="size-4 shrink-0 translate-y-0.5 text-amber-600 dark:text-amber-400" aria-label="In progress" />
  }
  return <CircleDashed className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" aria-label="Not started" />
}

export function AcceptanceProgress({
  total,
  verified,
  implemented,
  remaining = [],
  checklist = [],
  completionEligible,
  historical = false,
  unmapped = 0,
}: {
  total: number
  verified: number
  implemented: number
  remaining?: string[]
  checklist?: CompletionChecklistItem[]
  completionEligible?: boolean
  historical?: boolean
  unmapped?: number
}) {
  const checks = acceptanceProgress(total, verified, implemented)
  const progress = completionProgress(checklist, completionEligible, total)

  return (
    <section className="space-y-2 rounded-xl border border-border p-4" aria-label="Acceptance progress">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{historical ? "Current readiness" : "Work progress"}</h2>
        <p className="text-lg font-semibold tabular-nums">
          {progress.percent === null ? total === 0 ? "No acceptance criteria" : "Completion unavailable" : `${progress.done}/${progress.total} complete · ${progress.percent}%`}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Overall completion tasks"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent ?? undefined}
        aria-valuetext={progress.percent === null ? "Completion is indeterminate" : `${progress.done} of ${progress.total} completion tasks complete`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] [transition-duration:var(--nessa-motion-duration-normal)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none"
          style={{ width: `${progress.percent ?? 0}%` }}
        />
      </div>
      {unmapped > 0 && <p className="text-sm">{unmapped} requirements have no linked checks yet.</p>}
      {historical && progress.percent !== 100 && <p className="text-sm">Completed earlier; current completion tasks need rechecking.</p>}
      {checklist.length > 0 && (
        <div className="space-y-1.5 text-sm">
          <p className="font-medium">{historical ? "Needs rechecking" : "Completion checklist"}</p>
          <ul className="space-y-1">
            {[...checklist].sort((a, b) => (checklistOrder[a.id] ?? 9) - (checklistOrder[b.id] ?? 9)).map(item => (
              <li key={item.id} className="flex items-baseline gap-2">
                <ChecklistMark state={item.state} />
                <span className={item.state === "done" ? "text-muted-foreground" : undefined}>
                  <ReadableText>{item.label}</ReadableText>
                  {item.total ? <span className="text-muted-foreground"> · {item.done ?? 0}/{item.total}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {checklist.length === 0 && remaining.length > 0 && (
        <div className="space-y-1 text-sm">
          <p className="font-medium">{historical ? "Needs rechecking" : "Still needed"}</p>
          <ul className="list-disc space-y-1 pl-5">{remaining.map(reason => <li key={reason}><ReadableText>{reason}</ReadableText></li>)}</ul>
        </div>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">About this progress</summary>
        <div className="mt-2 space-y-2">
          <p>The percentage counts all applicable completion tasks in the checklist. Requirements need both current implementation and passing evidence. Reviews, screenshots, workflow results and closing work also count when required.</p>
          <p>Current checks: {checks.verified}/{checks.total} verified · evidence only</p>
          <p>Current implementation reports: {checks.implemented}/{checks.total} · agent reported</p>
          {progress.percent === null && <p>Completion remains unknown until acceptance scope and a consistent completion observation are available.</p>}
          {historical && <p>This work was completed earlier. These counts describe readiness on the current code.</p>}
          {checklist.length > 0 && remaining.length > 0 && <ul className="list-disc space-y-1 pl-5">{remaining.map(reason => <li key={reason}><ReadableText>{reason}</ReadableText></li>)}</ul>}
        </div>
      </details>
    </section>
  )
}
