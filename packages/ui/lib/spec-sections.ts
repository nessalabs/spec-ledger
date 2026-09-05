export type SpecSection = "evidence" | "changes" | "process"

/** Preserve links shared before the spec page gained sections. */
export function specSectionForHash(hash: string): SpecSection {
  if (hash === "#changes") return "changes"
  if (["#process", "#engineering-method", "#agent-execution", "#execution-activity"].includes(hash)) return "process"
  return "evidence"
}
