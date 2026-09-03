import type { Review } from "../types.js"

/** Schema / Lattice rules for plainSummary + finding plainImpact. */
export function latticeCopyProblems(review: Review): string[] {
  const problems: string[] = []
  if (!review.plainSummary?.trim()) {
    problems.push("plainSummary required (one Lattice sentence)")
  } else if (review.plainSummary.length > 280) {
    problems.push("plainSummary must be <= 280 characters")
  }
  for (const f of review.findings ?? []) {
    if (!f.plainImpact?.trim()) {
      problems.push(`finding ${f.id}: plainImpact required`)
    } else if (f.plainImpact.length > 280) {
      problems.push(`finding ${f.id}: plainImpact must be <= 280 characters`)
    }
  }
  return problems
}

export function assertReviewLatticeCopy(review: Review): void {
  const problems = latticeCopyProblems(review)
  if (problems.length) {
    throw new Error(
      `review ${review.id} Lattice copy invalid: ${problems.join("; ")}`,
    )
  }
}
