/** Guard display boundaries without inventing an empty, valid architecture. */
export function graphDisplayIssue(value: unknown): string | null {
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
  if (!object(value)) return "No graph loaded."
  if (!object(value.system) || typeof value.system.revision !== "string") return "Graph data is incomplete: system revision is missing."
  for (const field of ["layers", "nodes", "edges", "features"] as const) {
    if (!Array.isArray(value[field])) return `Graph data is incomplete: ${field} must be a list.`
  }
  const rows = (field: string, keys: string[]) => (value[field] as unknown[]).every(row =>
    object(row) && keys.every(key => typeof row[key] === "string") &&
    (row.name === undefined || typeof row.name === "string") &&
    (row.claimIds === undefined || (Array.isArray(row.claimIds) && row.claimIds.every(id => typeof id === "string"))))
  if (!rows("layers", ["id", "name"]) || !rows("nodes", ["id", "layer"]) ||
      !rows("edges", ["from", "to", "kind"]) || !rows("features", ["id", "name", "summary"])) {
    return "Graph data is incomplete: one or more entries have invalid fields."
  }
  return null
}
