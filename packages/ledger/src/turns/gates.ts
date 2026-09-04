import { permissionStatus } from "../permission/authority.js"
import {
  codeBreakSatisfied,
  listReviewsForTurn,
  unresolvedBlockingReviews,
} from "../reviews/load.js"
import { latticeCopyProblems } from "../reviews/lattice-copy.js"
import { blockedAutomationEvents } from "../automation/load.js"
import { loadWorkstream } from "../workstream/load.js"
import { changedPathsSince, computeTreeDigest } from "../git/tree.js"
import { isExemptPath } from "../align/paths.js"
import { assertAlignCloseAllowed } from "../align/approve.js"
import type { Turn } from "../types.js"

/**
 * Close gates for workstream-bound turns. Legacy turns (no workstreamId) are
 * unconstrained here — verify still runs on close.
 */
export function assertTurnCloseAllowed(repoRoot: string, turn: Turn): void {
  const workstreamId = turn.intent.workstreamId
  if (!workstreamId) return

  const eligibility = permissionStatus(repoRoot,workstreamId)
  if (!eligibility.allowed) throw new Error(`turn close refused: ${eligibility.reasons.join("; ")}`)
  const ws = loadWorkstream(repoRoot, workstreamId)
  const policy = (ws.policy ?? {}) as { requireCodeBreak?: boolean }
  const requireCodeBreak = policy.requireCodeBreak !== false

  const reviews = listReviewsForTurn(repoRoot, turn.id)
  for (const r of reviews) {
    const problems = latticeCopyProblems(r)
    if (problems.length) {
      throw new Error(
        `turn close refused: review ${r.id} Spec Ledger UI copy invalid: ${problems.join("; ")}`,
      )
    }
  }
  const unresolved = unresolvedBlockingReviews(reviews)
  if (unresolved.length) {
    throw new Error(
      `turn close refused: unresolved blocking review(s): ${unresolved.map((r) => r.id).join(", ")}`,
    )
  }

  if (requireCodeBreak && !codeBreakSatisfied(reviews, computeTreeDigest(repoRoot))) {
    throw new Error(
      `turn close refused: workstream ${workstreamId} requireCodeBreak — need adversarial code review with verdict approve and non-empty killersCited (comment / bare approve do not count)`,
    )
  }

  let paths: string[]
  try {
    paths = changedPathsSince(repoRoot, turn.opened?.baseCommit)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(
      `turn close refused: workstream ${workstreamId} requireAlignApprove — ${detail}`,
    )
  }
  const productPaths = paths.filter((p) => p && !isExemptPath(p))
  const treeDigest = computeTreeDigest(repoRoot)
  assertAlignCloseAllowed({
    turn,
    workstream: ws,
    reviews,
    treeDigest,
    productPathCount: productPaths.length,
    repoRoot,
  })

  const blocked = blockedAutomationEvents(repoRoot, {
    workstreamId,
    turnId: turn.id,
  })
  if (blocked.length) {
    throw new Error(
      `turn close refused: blocked automation event(s): ${blocked.map((e) => e.id).join(", ")}`,
    )
  }
}
