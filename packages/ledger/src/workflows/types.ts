export const WORKFLOW_OUTPUT_KINDS = [
  "spec-revision", "spec-review", "implementation-report", "check-results", "code-review", "attestation",
] as const
export type WorkflowOutputKind = typeof WORKFLOW_OUTPUT_KINDS[number]
export type WorkflowStageRole = "plan" | "spec-review" | "implement" | "verify" | "code-review"

export interface WorkflowOutputContract { kind: WorkflowOutputKind; criterionIds?: string[] }
export interface WorkflowSkillReference {
  path: string
  capabilities?: WorkflowOutputKind[]
  acknowledgeUncertain?: boolean
}
export interface WorkflowProfileStep {
  id: string
  title: string
  skill: string | WorkflowSkillReference
  outputs: WorkflowOutputContract[]
}
export interface WorkflowProfileStage {
  id: string
  title: string
  role: WorkflowStageRole
  /**
   * Whether this stage counts toward completion. Omitted means "ask the
   * workstream policy" — never inferred from where the workflow came from.
   */
  required?: boolean
  steps: WorkflowProfileStep[]
}
export interface WorkflowProfile {
  id: string
  title: string
  extends?: "spec-ledger/default"
  skills?: Record<string, WorkflowSkillReference>
  stages?: WorkflowProfileStage[]
}
export interface ResolvedWorkflowSkill {
  id: string
  source: "bundled" | "local"
  path?: string
  digest: string
  content: string
  capabilities: WorkflowOutputKind[]
  capability: "declared" | "uncertain"
  uncertaintyAcknowledged: boolean
}
export interface ResolvedWorkflowStep extends Omit<WorkflowProfileStep, "skill"> { skill: ResolvedWorkflowSkill }
export interface ResolvedWorkflowStage extends Omit<WorkflowProfileStage, "steps"> { steps: ResolvedWorkflowStep[] }
/**
 * Where a snapshot's steps came from. Provenance only — stage applicability is
 * decided by `WorkflowProfileStage.required` plus workstream policy, never by
 * this field, so a new source cannot silently change what counts as done.
 */
export type WorkflowProfileSource = "default" | "custom" | "library"

export interface WorkflowSnapshotProfile {
  id: string
  title: string
  source: WorkflowProfileSource
  /** For `library`: the digest of the saved profile record this copied. */
  profileDigest?: string
}

/** A workflow saved under a name, reusable across workstreams. */
export interface SavedWorkflowProfile {
  schemaVersion: 1
  id: string
  title: string
  skills?: Record<string, WorkflowSkillReference>
  stages: WorkflowProfileStage[]
  createdAt: string
  updatedAt: string
  /** sha256 of this record without `digest`; the version callers pin on write. */
  digest: string
}

export interface WorkflowLibraryEntry {
  id: string
  title: string
  digest: string
  updatedAt: string
  isDefault: boolean
  /** Null when the asked-about workstream can adopt this profile. */
  unusableReason: string | null
}

export interface WorkflowSnapshot {
  schemaVersion: 1
  snapshotId: string
  snapshotDigest: string
  workstreamId: string
  revisionDigest: string
  profile: WorkflowSnapshotProfile
  stages: ResolvedWorkflowStage[]
  createdAt: string
  reason?: string
  supersedesSnapshotDigest?: string
}
export interface WorkflowAttempt {
  schemaVersion: 1; id: string; workstreamId: string; stageId: string; stepId: string
  snapshotDigest: string; revisionDigest: string; sourceDigest: string; startedAt: string
  reason?: string
}
export interface WorkflowAttemptReport {
  schemaVersion: 1; attemptId: string; status: "reported-complete" | "blocked"; reason?: string; reportedAt: string
}
export interface WorkflowOutputReference {
  schemaVersion: 1; id: string; workstreamId: string; attemptId: string; kind: WorkflowOutputKind
  recordType: "snapshot" | "review" | "decision" | "result"; recordIds: string[]; criterionIds: string[]
  snapshotDigest: string; revisionDigest: string; sourceDigest: string; recordedAt: string
}

export interface WorkflowOutputProjection extends WorkflowOutputReference {
  current: boolean; attested: boolean; reason: string | null
}
export interface WorkflowProjection {
  profile: WorkflowSnapshotProfile & { snapshotId: string | null; snapshotDigest: string; revisionDigest: string; reason?: string }
  status: "ready" | "running" | "blocked" | "satisfied"
  currentStageId: string | null
  blockers: string[]
  historicalSnapshots: Array<{ snapshotId: string; digest: string; revisionDigest: string; reason?: string; createdAt: string }>
  stages: Array<{
    id: string; title: string; role: WorkflowStageRole; status: "ready" | "running" | "blocked" | "satisfied" | "not-applicable"; blockers: string[]
    requiredOutputs: Array<{ stepId: string; stepTitle: string; kind: WorkflowOutputKind; criterionIds: string[]; satisfied: boolean; current: boolean; reason: string | null; refs: WorkflowOutputProjection[] }>
    steps: Array<{
      id: string; title: string; status: "ready" | "running" | "blocked" | "satisfied" | "not-applicable"; skill: ResolvedWorkflowSkill
      attempts: Array<{ id: string; snapshotDigest: string; revisionDigest: string; sourceDigest: string; startedAt: string; reportedStatus: "running" | "reported-complete" | "blocked"; reason?: string; outputRefs: WorkflowOutputProjection[] }>
    }>
  }>
}
