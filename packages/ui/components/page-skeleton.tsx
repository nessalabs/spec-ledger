const BAR = "animate-pulse rounded bg-muted/50"

/**
 * Shown while a route's server data is still loading. Every page is
 * `force-dynamic`, so without this Next blocks the whole navigation and the
 * previous page stays on screen with no sign that anything is happening.
 */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="mx-auto flex max-w-5xl flex-col gap-6"
      role="status"
      aria-label="Loading"
    >
      <div className="flex flex-col gap-2">
        <div className={`${BAR} h-7 w-48`} />
        <div className={`${BAR} h-4 w-full max-w-2xl`} />
      </div>
      <div className="flex flex-col gap-px overflow-hidden rounded-lg border border-border">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <div className={`${BAR} h-4 flex-1`} />
            <div className={`${BAR} h-4 w-12 shrink-0`} />
          </div>
        ))}
      </div>
    </div>
  )
}
