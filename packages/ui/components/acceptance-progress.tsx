
import { ReadableText } from "@/components/readable-text"
import { acceptanceProgress } from "@/lib/acceptance-progress"
import { Check, CircleDashed, Loader } from "lucide-react"
import type { CompletionChecklistItem } from "@nessalabs/spec-ledger-client"

// Keep completed and pending gates in the same workflow order.
const checklistOrder: Record<string, number> = {
  seal: 0,
  'spec-review': 1,
  criteria: 2,
  'code-review': 3,
  workflow: 4,
  turn: 5,
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
  historical = false,
  unmapped = 0,
}: {
  total: number
  verified: number
  implemented: number
  remaining?: string[]
  checklist?: CompletionChecklistItem[]
  historical?: boolean
  unmapped?: number
}) {
  const progress = acceptanceProgress(total, verified, implemented)

  if (progress.percent === null) {
    return (
      <section className="space-y-2 rounded-xl border border-border p-4" aria-label="Acceptance progress">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Current checks</h2>
          <p className="text-sm font-medium">No acceptance criteria</p>
        </div>
        <div
          role="progressbar"
          aria-label="Acceptance verification is indeterminate because no criteria are defined"
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 overflow-hidden rounded-full bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Verification progress is available after acceptance criteria are defined.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-2 rounded-xl border border-border p-4" aria-label="Acceptance progress">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Current checks</h2>
        <p className="text-lg font-semibold tabular-nums">
          {progress.verified}/{progress.total} verified · {progress.percent}%
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Acceptance criteria with current passing evidence"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-valuetext={`${progress.verified} of ${progress.total} acceptance criteria verified`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] [transition-duration:var(--nessa-motion-duration-normal)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {unmapped > 0 && <p className="text-sm">{unmapped} requirements have no linked checks yet.</p>}
      {historical && progress.verified < progress.total && <p className="text-sm">Completed earlier; some evidence needs rechecking.</p>}
      {checklist.length > 0 && (
        <div className="space-y-1.5 text-sm">
          <p className="font-medium">{historical ? "Needs rechecking" : "Completion checklist"}</p>
          <ul className="space-y-1">
            {[...checklist].sort((a, b) => (checklistOrder[a.id] ?? 6) - (checklistOrder[b.id] ?? 6)).map(item => (
              <li key={item.id} className="flex items-baseline gap-2">
                <ChecklistMark state={item.state} />
                <span className={item.state === "done" ? "text-muted-foreground" : undefined}>
                  {item.label.startsWith("Attach screenshots of all relevant UI") ? "Current screenshots for every required screen" : item.label}
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
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">About this progress</summary><div className="mt-2 space-y-2"><p>Current implementation reports: {progress.implemented}/{progress.total} · agent reported</p><p>The percentage counts requirements with current passing evidence. Reviews and other completion requirements are checked separately.</p>{historical && <p>This work was completed earlier. These counts describe evidence on the current code.</p>}</div></details>
    </section>
  )
}
