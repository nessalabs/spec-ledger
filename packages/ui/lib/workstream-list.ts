import type { SessionProjection, Turn, Workstream } from "@nessalabs/spec-ledger-client"
import { completionProgress } from "./acceptance-progress"

export const SPEC_VIEWS = ["active", "all", "completed", "cancelled"] as const
export type SpecView = typeof SPEC_VIEWS[number]
export const SPEC_PAGE_SIZE = 20

/** Active is an unfinished spec, not a claim that an agent is running. */
export function isActiveSpec(workstream: Pick<Workstream, "status">): boolean {
  return workstream.status !== "done" && workstream.status !== "cancelled"
}

export function specView(value?: string): SpecView {
  return SPEC_VIEWS.includes(value as SpecView) ? value as SpecView : "active"
}

export function specViewCounts(workstreams: Workstream[]): Record<SpecView, number> {
  return {
    active: workstreams.filter(isActiveSpec).length,
    all: workstreams.length,
    completed: workstreams.filter(w => w.status === "done").length,
    cancelled: workstreams.filter(w => w.status === "cancelled").length,
  }
}

export function isFixup(turn: Turn): boolean {
  return turn.intent.changeType === "fix" && Boolean(turn.intent.workstreamId)
}

export function workstreamFixups(turns: Turn[], workstreamId: string): Turn[] {
  return turns.filter(t => t.intent.workstreamId === workstreamId && isFixup(t) && t.status !== "abandoned")
    .sort((a, b) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt) || a.id.localeCompare(b.id))
}

export function specListPage(workstreams: Workstream[], turns: Turn[], view: SpecView, requestedPage?: string) {
  const latest = new Map<string, string>()
  for (const turn of turns) {
    const id = turn.intent.workstreamId
    if (!id || turn.status === "abandoned") continue
    const at = turn.closedAt ?? turn.openedAt
    if (at > (latest.get(id) ?? "")) latest.set(id, at)
  }
  const at = (w: Workstream) => [w.updatedAt ?? "", w.createdAt ?? "", latest.get(w.id) ?? ""].sort().at(-1) ?? ""
  const filtered = workstreams.filter(w => view === "all" || (view === "active" ? isActiveSpec(w) : w.status === (view === "completed" ? "done" : "cancelled")))
    .sort((a, b) => at(b).localeCompare(at(a)) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
  const pages = Math.max(1, Math.ceil(filtered.length / SPEC_PAGE_SIZE))
  const parsed = Number(requestedPage ?? 1)
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, pages) : 1
  return { workstreams: filtered.slice((page - 1) * SPEC_PAGE_SIZE, page * SPEC_PAGE_SIZE), page, pages, total: filtered.length }
}

export type SpecListProgress = ReturnType<typeof completionProgress>
export type FixupLink = Pick<Turn, "id" | "status" | "openedAt" | "closedAt"> & { title: string }
export type SpecListRow = { workstream: Workstream; progress: SpecListProgress | null; latestFixup: FixupLink | null }

/** Never let an unavailable or mismatched observation become a completion number. */
export function specListProgress(workstreamId: string, projection: SessionProjection | null): SpecListProgress | null {
  const session = projection?.session
  if (!session || session.workstreamId !== workstreamId || !Array.isArray(session.criteria) || !Array.isArray(session.completion?.checklist)) return null
  if (session.completion.checklist.some(item => !item || !["done", "in-progress", "todo"].includes(item.state))) return null
  return completionProgress(session.completion.checklist, session.completion.eligible, session.criteria.length)
}

export function fixupLink(turn: Turn): FixupLink {
  return { id: turn.id, title: turn.intent.restatedGoal, status: turn.status, openedAt: turn.openedAt, closedAt: turn.closedAt }
}

export function specStageLabel(status: Workstream["status"]): string {
  return ({ draft: "Draft", shaped: "Ready for review", spec_review: "In review", sealed: "Ready to start", active: "In progress", done: "Completed earlier", cancelled: "Cancelled" })[status]
}
