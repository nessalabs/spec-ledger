import type { Review, Turn, Workstream } from "../types.js"
import { listAlignWaiversForTurn, type AlignWaiver } from "./waiver.js"

export interface AlignPolicy {
  requireAlignApprove?: boolean
  alignReviewerPrefix?: string
  allowExplicitAlignSkip?: boolean
  alignSkipMaxPerTurn?: number
  alignWaiverMinReasonChars?: number
}

export function alignPolicy(ws: Workstream): AlignPolicy {
  return (ws.policy ?? {}) as AlignPolicy
}

export function isAlignApproveReview(review: Review, prefix: string): boolean {
  if (review.target === "spec") return false
  if (review.verdict !== "approve") return false
  if (!review.treeDigest || review.treeDigest.length < 16) return false
  if (!review.coverageSource) return false
  if (!Array.isArray(review.uncoveredPaths)) return false
  if (!review.reviewer.startsWith(prefix)) return false
  const uncovered = review.uncoveredPaths
  const waivers = review.waiverIds ?? []
  if (uncovered.length > 0 && waivers.length === 0) return false
  return true
}

/**
 * Validate a candidate align approve review. Throws on policy violations.
 * Does not require killersCited (align ≠ code-break).
 */
export function assertAlignApproveValid(args: {
  review: Review
  turn: Turn
  policy: AlignPolicy
}): void {
  const { review, turn, policy } = args
  const prefix = policy.alignReviewerPrefix ?? "agent:align"
  if (review.verdict !== "approve") {
    throw new Error("align approve refused: verdict must be approve")
  }
  if (!review.treeDigest || review.treeDigest.length < 16) {
    throw new Error("align approve refused: treeDigest required")
  }
  if (!review.coverageSource) {
    throw new Error("align approve refused: coverageSource required")
  }
  if (!Array.isArray(review.uncoveredPaths)) {
    throw new Error("align approve refused: uncoveredPaths array required")
  }
  if (!review.reviewer.startsWith(prefix)) {
    throw new Error(
      `align approve refused: reviewer must start with ${prefix} (got ${review.reviewer})`,
    )
  }
  const producer = turn.opened?.producedBy
  if (producer && review.reviewer === producer) {
    throw new Error("align approve refused: reviewer must not equal turn producer")
  }
  if (
    review.uncoveredPaths.length > 0 &&
    !(review.waiverIds && review.waiverIds.length > 0)
  ) {
    throw new Error(
      "align approve refused: uncoveredPaths non-empty without waiverIds",
    )
  }
}

export function alignApproveSatisfied(args: {
  reviews: Review[]
  waivers: AlignWaiver[]
  treeDigest: string
  policy: AlignPolicy
  turnHasProductFiles: boolean
}): boolean {
  const { reviews, waivers, treeDigest, policy, turnHasProductFiles } = args
  if (!policy.requireAlignApprove) return true
  if (!turnHasProductFiles) return true

  const prefix = policy.alignReviewerPrefix ?? "agent:align"
  const approve = reviews.some(
    (r) => isAlignApproveReview(r, prefix) && r.treeDigest === treeDigest,
  )
  if (approve) return true

  if (policy.allowExplicitAlignSkip === false) return false
  return waivers.some((w) => w.treeDigest === treeDigest)
}

export function assertAlignCloseAllowed(args: {
  turn: Turn
  workstream: Workstream
  reviews: Review[]
  treeDigest: string
  productPathCount: number
  repoRoot: string
}): void {
  const { turn, workstream, reviews, treeDigest, productPathCount } = args
  const policy = alignPolicy(workstream)
  if (!policy.requireAlignApprove) return
  if (productPathCount === 0) return

  const waivers = listAlignWaiversForTurn(args.repoRoot, turn.id)
  const ok = alignApproveSatisfied({
    reviews,
    waivers,
    treeDigest,
    policy,
    turnHasProductFiles: productPathCount > 0,
  })
  if (!ok) {
    throw new Error(
      `turn close refused: workstream ${workstream.id} requireAlignApprove — need align approve (reviewer ${policy.alignReviewerPrefix ?? "agent:align"}* + treeDigest) or explicit waiver for treeDigest ${treeDigest.slice(0, 12)}…`,
    )
  }
}
