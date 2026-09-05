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
