import { acceptanceProgress } from "@/lib/acceptance-progress"

export function AcceptanceProgress({
  total,
  verified,
  implemented,
  remaining = [],
}: {
  total: number
  verified: number
  implemented: number
  remaining?: string[]
}) {
  const progress = acceptanceProgress(total, verified, implemented)

  if (progress.percent === null) {
    return (
      <section className="space-y-2 rounded-xl border border-border p-4" aria-label="Acceptance progress">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Acceptance progress</h2>
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
        <h2 className="font-semibold">Acceptance progress</h2>
        <p className="text-lg font-semibold tabular-nums">
          Verified {progress.verified}/{progress.total} · {progress.percent}%
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
      <p className="text-xs text-muted-foreground">
        Implemented {progress.implemented}/{progress.total} · agent reported
      </p>
      {progress.percent === 100 && remaining.length ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Acceptance evidence is complete. The workstream still needs:</p>
          <ul className="list-disc space-y-1 pl-5">
            {remaining.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      ) : progress.percent === 100 ? (
        <p className="text-xs text-muted-foreground">
          Acceptance evidence is complete. Workstream completion is evaluated separately.
        </p>
      ) : null}
    </section>
  )
}
