import type { CompletionChecklistItem } from "@nessalabs/spec-ledger-client"

export type AcceptanceProgress = {
  total: number
  verified: number
  implemented: number
  percent: number | null
}

/** Normalize acceptance counts and derive an honest whole-number percentage. */
export function acceptanceProgress(
  totalCount: number,
  verifiedCount: number,
  implementedCount: number,
): AcceptanceProgress {
  const total = Math.max(0, Math.floor(totalCount))
  const verified = Math.min(total, Math.max(0, Math.floor(verifiedCount)))
  const implemented = Math.min(total, Math.max(0, Math.floor(implementedCount)))
  const percent =
    total === 0
      ? null
      : verified === total
        ? 100
        : Math.min(99, Math.floor((verified / total) * 100))

  return { total, verified, implemented, percent }
}

/** Count the completion checklist's actual tasks, independently of passing checks. */
export function completionProgress(
  checklist: CompletionChecklistItem[],
  eligible: boolean | undefined,
  criteriaCount: number,
): { total: number; done: number; percent: number | null } {
  let total = 0
  let done = 0
  let consistent = true
  for (const item of checklist) {
    const parts = item.total === undefined ? 1 : Math.max(1, Math.floor(item.total))
    const finished = item.state === "done" ? parts : Math.max(0, Math.min(parts, Math.floor(item.done ?? 0)))
    const validTotal = item.total === undefined || (Number.isInteger(item.total) && item.total >= 0)
    const validDone = item.done === undefined || (Number.isInteger(item.done) && item.done >= 0 && item.done <= parts)
    const stateMatchesCount = item.state === "done"
      ? item.done === undefined || item.done === parts
      : finished < parts
    if (!validTotal || !validDone || !stateMatchesCount || !Number.isFinite(parts) || !Number.isFinite(finished)) consistent = false
    total += Number.isFinite(parts) ? parts : 0
    done += Number.isFinite(finished) ? finished : 0
  }
  // Unknown scope, missing observation, or contradictory task/gate states are not completion.
  const known = Number.isFinite(criteriaCount) && criteriaCount > 0 && total > 0 && typeof eligible === "boolean" && consistent && (eligible === (done === total))
  const percent = !known ? null : eligible ? 100 : Math.min(99, Math.floor(done / total * 100))
  return { total, done, percent }
}
