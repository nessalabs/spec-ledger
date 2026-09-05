export type WorkflowDisplayStatus =
  | "ready"
  | "running"
  | "blocked"
  | "satisfied"
  | "not-applicable"

export function workflowStatusView(status: WorkflowDisplayStatus) {
  switch (status) {
    case "running":
      return { label: "Running", taskStatus: "active" as const }
    case "blocked":
      return { label: "Blocked", taskStatus: null }
    case "satisfied":
      return { label: "Satisfied", taskStatus: "done" as const }
    case "not-applicable":
      return { label: "Not applicable", taskStatus: null }
    default:
      return { label: "Ready", taskStatus: "todo" as const }
  }
}

export function digestLabel(digest: string) {
  return digest.length > 16 ? `${digest.slice(0, 16)}…` : digest
}

const OUTPUT_LABELS = {
  "spec-revision": "Preserved spec",
  "spec-review": "Spec review",
  "implementation-report": "Implementation report",
  "check-results": "Check results",
  "code-review": "Code review",
  attestation: "Attestation",
} as const

export function workflowOutputLabel(kind: keyof typeof OUTPUT_LABELS) {
  return OUTPUT_LABELS[kind]
}
