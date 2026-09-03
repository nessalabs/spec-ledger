import { Badge } from "@nessa-ui/react"
import type { DigestFreshness } from "@/lib/turns"

export function FreshnessBadge({ freshness }: { freshness: DigestFreshness }) {
  if (freshness === "current") {
    return <Badge variant="default">digests current</Badge>
  }
  if (freshness === "stale") {
    return <Badge variant="destructive">digests stale → unknown</Badge>
  }
  return <Badge variant="outline">digests unknown</Badge>
}

/** Turn's recorded verify — only show pass/fail when digests still match live report. */
export function TurnVerifyBadge({
  ok,
  freshness,
}: {
  ok: boolean | undefined
  freshness: DigestFreshness
}) {
  if (ok == null) return <Badge variant="outline">no facts</Badge>
  if (freshness !== "current") {
    return <Badge variant="outline">verify unknown</Badge>
  }
  return (
    <Badge variant={ok ? "default" : "destructive"}>
      verify {ok ? "OK" : "FAIL"}
    </Badge>
  )
}
