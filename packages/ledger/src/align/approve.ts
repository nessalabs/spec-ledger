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

/** Default prefix; empty / whitespace is invalid (not "match anything"). */
export function resolveAlignReviewerPrefix(policy: AlignPolicy): string {
  if (policy.alignReviewerPrefix === undefined || policy.alignReviewerPrefix === null) {
    return "agent:align"
  }
  const t = String(policy.alignReviewerPrefix).trim()
  if (!t) {
    throw new Error(
      "align approve refused: alignReviewerPrefix must not be empty (blank prefix)",
    )
  }
  return t
}

function waiverIdsResolved(
  review: Review,
  waivers: AlignWaiver[],
): boolean {
  const ids = review.waiverIds ?? []
  if (!ids.length) return false
  const byId = new Map(waivers.map((w) => [w.id, w]))
  for (const id of ids) {
    const w = byId.get(id)
    if (!w) return false
    if (w.treeDigest !== review.treeDigest) return false
    if (review.turnId && w.turnId && w.turnId !== review.turnId) return false
  }
  return true
}

export function isAlignApproveReview(
  review: Review,
  prefix: string,
  waivers: AlignWaiver[] = [],
): boolean {
  if (review.target === "spec") return false
  if (review.verdict !== "approve") return false
  if (!review.treeDigest || review.treeDigest.length < 16) return false
  if (!review.coverageSource) return false
  if (!Array.isArray(review.uncoveredPaths)) return false
  if (!review.plainSummary?.trim() || review.plainSummary.length > 280) return false
  if (!review.reviewer.startsWith(prefix)) return false
  const uncovered = review.uncoveredPaths
  if (uncovered.length > 0 && !waiverIdsResolved(review, waivers)) return false
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
  waivers?: AlignWaiver[]
}): void {
  const { review, turn, policy } = args
  const prefix = resolveAlignReviewerPrefix(policy)
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
  if (!review.plainSummary?.trim()) {
    throw new Error("align approve refused: plainSummary required (one Spec Ledger UI sentence)")
  }
  if (review.plainSummary.length > 280) {
    throw new Error("align approve refused: plainSummary must be <= 280 characters")
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
  if (review.uncoveredPaths.length > 0) {
    const waivers = args.waivers ?? []
    if (!waiverIdsResolved(review, waivers)) {
      throw new Error(
        "align approve refused: uncoveredPaths non-empty without resolved waiverIds for this treeDigest",
      )
    }
  }
}

export function alignApproveSatisfied(args: {
  reviews: Review[]
  waivers: AlignWaiver[]
  treeDigest: string
  policy: AlignPolicy
  turnHasProductFiles: boolean
  producer?: string
}): boolean {
  const { reviews, waivers, treeDigest, policy, turnHasProductFiles } = args
  if (!policy.requireAlignApprove) return true
  if (!turnHasProductFiles) return true

  let prefix: string
  try {
    prefix = resolveAlignReviewerPrefix(policy)
  } catch {
    return false
  }

  const approve = reviews.some((r) => {
    if (args.producer && r.reviewer === args.producer) return false
    return isAlignApproveReview(r, prefix, waivers) && r.treeDigest === treeDigest
  })
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
  const producer = turn.opened?.producedBy
  const ok = alignApproveSatisfied({
    reviews,
    waivers,
    treeDigest,
    policy,
    turnHasProductFiles: productPathCount > 0,
    producer,
  })
  if (!ok) {
    // Explicit producer collision message when that is the only blocker shape
    const prefix = (() => {
      try {
        return resolveAlignReviewerPrefix(policy)
      } catch {
        return "agent:align"
      }
    })()
    const selfApprove = reviews.some(
      (r) =>
        r.verdict === "approve" &&
        r.coverageSource &&
        r.treeDigest === treeDigest &&
        producer &&
        r.reviewer === producer &&
        r.reviewer.startsWith(prefix),
    )
    if (selfApprove) {
      throw new Error(
        `turn close refused: align approve reviewer must not equal turn producer (${producer})`,
      )
    }
    throw new Error(
      `turn close refused: workstream ${workstream.id} requireAlignApprove — need align approve (reviewer ${prefix}* + treeDigest) or explicit waiver for treeDigest ${treeDigest.slice(0, 12)}…`,
    )
  }
}
