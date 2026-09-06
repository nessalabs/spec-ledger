/** The code map fills the viewport, so its placeholder must too. */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="h-[calc(100svh-4.5rem)] min-h-[28rem] animate-pulse rounded-xl border border-border bg-muted/30"
    />
  )
}
