"use client"

import { Badge } from "@nessa-ui/react"
import type { Turn } from "@nessa/spec-ledger-client"
import { PeekLink, turnPeekMarkdown } from "@/components/peek-link"
import {
  formatWhen,
  humanStatus,
  turnImpactSummary,
} from "@/lib/impact"
import type { VerifyReport } from "@nessa/spec-ledger-client"
import { turnFreshness } from "@/lib/turns"

export function CompactTurnRow({
  turn,
  report,
  workstreamTitle,
}: {
  turn: Turn
  report: VerifyReport | null
  workstreamTitle?: string | null
}) {
  const freshness = turnFreshness(turn, report)
  const impact = turnImpactSummary(turn)
  const when = formatWhen(turn.closedAt ?? turn.openedAt)
  const fileBit = impact.product.length
    ? `${impact.product.length} files${
        impact.additions || impact.deletions
          ? ` +${impact.additions}/−${impact.deletions}`
          : ""
      }`
    : turn.facts
      ? "ledger-only"
      : "open"
  const areas = impact.areas
    .slice(0, 3)
    .map((a) => a.area.replace(/^packages\//, ""))
    .join(", ")
  const wsId = turn.intent.workstreamId
  const goal = turn.intent.restatedGoal
  const peek = turnPeekMarkdown({
    id: turn.id,
    goal,
    workstreamId: wsId,
    workstreamTitle,
    status: humanStatus(turn.status),
    when,
    areas,
    fileBit,
  })

  return (
    <div className="grid gap-0.5 rounded-lg border border-border/80 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {wsId ? (
            <PeekLink
              href={`/workstreams/${encodeURIComponent(wsId)}`}
              peekPath={`peek:workstream/${wsId}`}
              peekLabel={wsId}
              peekContent={[
                `# ${workstreamTitle ?? wsId}`,
                "",
                `**${wsId}**`,
                "",
                `[Open full workstream](/workstreams/${encodeURIComponent(wsId)})`,
                "",
              ].join("\n")}
              title={workstreamTitle ?? wsId}
              className="no-underline"
            >
              <Badge
                variant="outline"
                className="font-mono text-[10px] font-normal"
              >
                {wsId}
              </Badge>
            </PeekLink>
          ) : null}
          <PeekLink
            href={`/turns/${turn.id}`}
            peekPath={`peek:turn/${turn.id}`}
            peekLabel={turn.id}
            peekContent={peek}
            className="min-w-0 flex-1 line-clamp-1 text-sm font-medium text-foreground no-underline hover:underline"
            title={`${turn.id} — ⌘/Ctrl-click to peek`}
          >
            {goal}
          </PeekLink>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {humanStatus(turn.status)}
          {areas ? ` · ${areas}` : ""}
          {` · ${fileBit}`}
          {freshness === "stale" ? " · verify outdated" : ""}
        </p>
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground">{when}</span>
    </div>
  )
}
