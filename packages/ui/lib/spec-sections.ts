export type SpecSection = "evidence" | "updates" | "changes" | "process"

/** Preserve links shared before the spec page gained sections. */
export function specSectionForHash(hash: string): SpecSection {
  if (hash === "#updates") return "updates"
  if (hash === "#changes") return "changes"
  if (["#workflow", "#process", "#engineering-method", "#agent-execution", "#execution-activity"].includes(hash)) return "process"
  return "evidence"
}
