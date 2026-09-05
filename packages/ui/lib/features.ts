/** Public labels/routes can change without rewriting graph joins or historical facts. */
export function featureSlug(id: string): string {
  return id === "lattice" ? "spec-ledger-ui" : id
}

export function featureLabel(id: string, name?: string): string {
  return id === "lattice" ? "Spec Ledger UI" : name ?? id
}

export function featureHref(id: string, features?: readonly { id: string }[]): string {
  const slug = id === "lattice" && features?.some(feature => feature.id === "spec-ledger-ui") ? id : featureSlug(id)
  return `/features/${encodeURIComponent(slug)}`
}

/** Prefer an exact ID if a consumer already owns the public slug. */
export function resolveFeatureId<T extends { id: string }>(features: T[], slug: string): T | undefined {
  return features.find(feature => feature.id === slug) ??
    (slug === "spec-ledger-ui" ? features.find(feature => feature.id === "lattice") : undefined)
}

export function featureSummary(id: string, summary?: string): string | undefined {
  return id === "lattice" ? summary?.replace(/\bLattice\b/gi, "Spec Ledger UI") : summary
}

/** Normalize product prose at presentation only; technical tokens retain their identity. */
export function presentationCopy(value: string | null | undefined): string {
  return (value ?? "").replace(/(`[^`]*`)|(?<![\w/.\-])lattice(?![\w/\-]|\.[a-z])/gi,
    (match, code: string | undefined) => code ?? "Spec Ledger UI")
}
