export type ClaimKind = "spec" | "adr" | "invariant" | "protocol" | "absence"
export type EvidenceKind = "test" | "check" | "contract" | "proof" | "attestation"
export type Outcome = "pass" | "fail" | "missing" | "attested" | "unbound"
export type EdgeKind =
  | "depends_on"
  | "related"
  | "calls"
  | "implements"
  | "reads"
  | "emits"
  | "supersedes"

export interface Claim {
  id: string
  kind: ClaimKind
  statement: string
  area?: string
  required: boolean
  deprecated?: boolean
  supersededBy?: string
  links?: {
    dependsOn?: string[]
    related?: string[]
    docs?: string[]
  }
}

export interface EvidenceBinding {
  id: string
  claimId: string
  kind: EvidenceKind
  locator: {
    type: "results-row" | "command" | "path" | "attestation"
    resultsKey?: string
    command?: string
    path?: string
    note?: string
  }
}

export interface ResultsRow {
  key: string
  outcome: "pass" | "fail" | "missing" | "attested"
  detail?: string
  durationMs?: number
}

export interface ResultsFile {
  schemaVersion: 1
  producedAt: string
  producer: { name: string; version: string }
  commit?: string
  rows: ResultsRow[]
}

export interface ClaimVerdict {
  claimId: string
  required: boolean
  outcome: Outcome
  bindingIds: string[]
  detail?: string
}

export interface VerifyReport {
  schemaVersion: 1
  producedAt: string
  producedBy: string
  ok: boolean
  provenance: {
    commit: string | null
    ledgerDigest: string
    resultsDigest: string
    treeHint: string
  }
  claims: ClaimVerdict[]
  graph?: {
    ok: boolean
    danglingNodes: string[]
    missingLocators: string[]
    freshness: "ok" | "stale" | "unknown"
  }
  problems: string[]
}

export interface GraphNode {
  id: string
  name?: string
  layer: string
  kind: "module" | "feature" | "adr" | "package" | "other"
  locator?: string
  featureIds?: string[]
  claimIds?: string[]
  purpose?: string
}

export interface GraphEdge {
  from: string
  to: string
  kind: EdgeKind
}

export interface FeatureMeta {
  id: string
  name: string
  summary: string
  claimIds?: string[]
  entryPoints?: string[]
  keywords?: string[]
  flow?: string
}

export interface CodebaseGraph {
  system: {
    name: string
    description: string
    revision: string
    languages?: string[]
  }
  layers: Array<{ id: string; name: string; blurb?: string }>
  features: FeatureMeta[]
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface LayerPolicy {
  layers: string[]
  allow: Record<string, string[]>
}

export interface LedgerRootConfig {
  schemaVersion: 1
  name: string
  claimsDir?: string
  bindingsDir?: string
  turnsDir?: string
  graphPath?: string
  policyPath?: string
  resultsPath?: string
  reportPath?: string
  visionPath?: string
  tenetsDir?: string
  workstreamsDir?: string
  proposedClaimsDir?: string
  reviewsDir?: string
  themesDir?: string
  decisionsDir?: string
  sourcesDir?: string
  attachmentsDir?: string
  probesDir?: string
  flowsDir?: string
  automationEventsDir?: string
  auditPolicyPath?: string
}

export type TurnStatus = "open" | "closed" | "abandoned"
export type TurnFileKind = "added" | "modified" | "deleted" | "renamed"

export interface TurnFileChange {
  path: string
  kind: TurnFileKind
  additions?: number
  deletions?: number
}

export interface TurnOpened {
  producedBy: string
  baseCommit: string | null
  treeDigest?: string
  dirtyAtOpen: string[]
  contextDigest?: string
  contextWorkstreamId?: string
  contextSliceId?: string
  contextSealRevision?: number
  contextGeneratedAt?: string
  noContextReason?: string
}

export interface TurnIntent {
  /** Ledger-facing ask after hygiene — not raw chat. See episodes.md. */
  userPrompt: string
  restatedGoal: string
  workstreamId?: string
  featureIds?: string[]
  primaryFeatureId?: string
  expectedClaimIds?: string[]
  sliceId?: string
  acceptanceCriteria?: string[]
  outOfScope?: string[]
  changeType?: "feature" | "refactor" | "fix" | "migration" | "chore" | "docs"
  riskLevel?: "low" | "moderate" | "elevated" | "high"
  claimedFeatureIds?: string[]
  claimedClaimIds?: string[]
  decisions?: Array<{
    decision: string
    rationale: string
    alternativesRejected?: string[]
  }>
  flows?: Array<{
    id: string
    title: string
    kind?: "flowchart" | "sequence" | "er" | "state"
    narrative?: string
    before?: string
    after: string
  }>
  summaryForSearch?: string
  keywords?: string[]
}

/** Written only by `spec-ledger turn close` — never agent self-report. */
export interface TurnFacts {
  producedBy: string
  commit: string | null
  files: TurnFileChange[]
  touchedNodeIds: string[]
  touchedFeatureIds: string[]
  touchedClaimIds: string[]
  blastRadius: { direct: string[]; transitive: string[] }
  verify: {
    ok: boolean
    ledgerDigest: string
    resultsDigest: string
    treeDigest?: string
    producedAt?: string
  }
  schemaSurfaceChanged: boolean
  decisionIds?: string[]
  decisionsDigest?: string
  sourcesDigest?: string
  attachmentsDigest?: string
  probesDigest?: string
  reviewsDigest?: string
  flowsDigest?: string
}

export interface Turn {
  schemaVersion: 1
  id: string
  status: TurnStatus
  openedAt: string
  closedAt?: string
  opened?: TurnOpened
  intent: TurnIntent
  facts?: TurnFacts
}

export interface WorkstreamSlice {
  id: string
  title: string
  kind: "vertical"
  acceptance: string[]
  evidence?: string[]
  expectedClaimIds?: string[]
  /** Product path prefixes/globs this vertical may cover (align check). */
  expectedPaths?: string[]
  notes?: string
  doneTurnId?: string
  codeBreakReviewId?: string
  specBreakReviewId?: string
}

export interface WorkstreamSeal {
  sealedAt: string
  sealedBy: string
  specDigest: string
  snapshotPath: string
  revision: number
  specBreakReviewId?: string
}

export interface Workstream {
  schemaVersion: 1
  id: string
  status:
    | "draft"
    | "shaped"
    | "spec_review"
    | "sealed"
    | "active"
    | "done"
    | "cancelled"
  createdAt: string
  updatedAt?: string
  themeId?: string
  featureIds: string[]
  primaryFeatureId?: string
  title: string
  problem: string
  objective: string
  /** Repo-relative Markdown humans review (docs/workstreams/<title-slug>.md). */
  specPath?: string
  appetite?: string
  changeType?: "feature" | "refactor" | "fix" | "migration" | "chore" | "docs"
  riskLevel?: "low" | "moderate" | "elevated" | "high"
  trust?: Record<string, unknown>
  policy?: Record<string, unknown>
  acceptanceCriteria?: string[]
  outOfScope?: string[]
  proposedClaimIds?: string[]
  suggestedSlices?: WorkstreamSlice[]
  seal?: WorkstreamSeal
  postSealAmends?: unknown[]
}

export interface Vision {
  schemaVersion: 1
  summary: string
  northStar?: string
  nonGoals?: string[]
  users?: string[]
  /** Repo-relative Markdown for human vision prose. */
  specPath?: string
  updatedAt?: string
  updatedBy?: string
}

export interface Tenet {
  schemaVersion: 1
  id: string
  statement: string
  scope?: string
  status: "active" | "deprecated"
  origin: "user" | "agent-confirmed" | "agent-inferred"
  weight?: "must" | "should" | "may"
  confirmedAt?: string
  confirmedBy?: string
  createdAt?: string
}

export interface VerticalContext {
  vision: Vision | null
  tenets: Tenet[]
  workstream: Workstream
  seal: WorkstreamSeal & { snapshot: Record<string, unknown> }
  slice: WorkstreamSlice
  claims: {
    live: Claim[]
    proposed: unknown[]
    bindings: EvidenceBinding[]
  }
  prior: {
    turns: Turn[]
    decisions: unknown[]
    openAutomationEvents?: AutomationEvent[]
    recentAutomationEvents?: AutomationEvent[]
  }
  graph: {
    nodes: GraphNode[]
    predictedBlastRadius: { direct: string[]; transitive: string[] }
    missingLocators?: string[]
  }
  policy: Workstream["policy"]
  trust: Workstream["trust"]
  contextDigest: string
  generatedAt: string
  truncation?: { decisions: number; turns: number; note: string }
}

export type ReviewVerdict = "approve" | "request-changes" | "comment"

export type ReviewEvidence =
  | {
      kind: "command"
      command: string
      observedOutput: string
      exitCode?: number
    }
  | {
      kind: "test"
      citedTest: string
      ran: true
      command?: string
      observedOutput?: string
    }

export interface ReviewFinding {
  id: string
  severity: "low" | "moderate" | "high" | "critical"
  claimId?: string
  gap: string
  fixProposal?: string
  evidence?: ReviewEvidence
  evidencePath?: string
}

export interface Review {
  schemaVersion: 1
  id: string
  turnId?: string
  workstreamId?: string
  kind?: "human" | "adversarial" | "discussion"
  target?: "spec" | "code"
  reviewer: string
  verdict: ReviewVerdict
  summary: string
  blocking?: boolean
  killersCited?: string[]
  findings?: ReviewFinding[]
  resolvesReviewId?: string
  supersedesReviewId?: string
  resolvesFindingIds?: string[]
}

export interface AutomationEvent {
  schemaVersion: 1
  id: string
  kind: "alert" | "sealed-deviation" | "awaiting-seal" | "waiver"
  workstreamId?: string
  turnId?: string
  reviewId?: string
  findingIds?: string[]
  mode: "move" | "block" | "wait"
  severity?: "low" | "moderate" | "high" | "critical"
  policySnapshot: Record<string, unknown>
  state: "pending" | "waiting" | "blocked" | "resolved"
  alertedAt: string
  waitUntil?: string
  trigger?: "human" | "timeout" | "system"
  resolution?: "move" | "block" | "waive" | "revert" | "cancel"
  resolvedAt?: string
  resolvedBy?: string
  decisionId?: string
  note?: string
}

export interface EpisodeDecision {
  schemaVersion: 1
  id: string
  turnId: string
  decision: string
  rationale: string
  alternativesRejected?: string[]
  addressesFindingIds?: string[]
  basis?: {
    contextDigest?: string
    sealRevision?: number
    at: string
  }
}

export interface EpisodeSource {
  schemaVersion: 1
  id: string
  turnId: string
  kind: string
  ref: string
  note?: string
}

export interface EpisodeAttachment {
  schemaVersion: 1
  id: string
  turnId: string
  /** What the artifact is — includes CR media kinds. */
  kind?:
    | "prompt"
    | "rationale"
    | "log-excerpt"
    | "diff-note"
    | "image"
    | "video"
    | "image-ref"
    | "other"
  title?: string
  /** IANA media type when known, e.g. image/png, video/mp4. */
  mediaType?: string
  path: string
  byteLength?: number
  contentDigest?: string
  note?: string
  decisionId?: string
  sourceId?: string
  probeId?: string
  /** Link to a code/spec review when this is CR evidence. */
  reviewId?: string
  flowId?: string
}

export interface EpisodeProbe {
  schemaVersion: 1
  id: string
  turnId: string
  question: string
  outcome?: string
  evidence?: string
}

export interface EpisodeFlow {
  schemaVersion: 1
  id: string
  turnId: string
  title: string
  kind?: "flowchart" | "sequence" | "er" | "state"
  after: string
  before?: string
  narrative?: string
}

export interface Theme {
  schemaVersion: 1
  id: string
  title: string
  summary: string
  status: "active" | "done" | "cancelled"
}

export interface ProposedClaim {
  schemaVersion: 1
  id: string
  statement: string
  status: "proposed" | "accepted" | "rejected" | "superseded"
  workstreamId?: string
  severity?: string
}

export interface AuditFinding {
  id: string
  severity: "info" | "warn" | "error"
  rule: string
  message: string
  turnId?: string
  workstreamId?: string
}

export interface AuditReport {
  ok: boolean
  producedAt: string
  findings: AuditFinding[]
}

export interface RelatedPack {
  workstreamId: string
  features: unknown[]
  claims: Claim[]
  proposedClaims: ProposedClaim[]
  turns: Turn[]
  docs: string[]
  worktreeCautions?: string[]
}

export interface LoadedLedger {
  rootDir: string
  repoRoot: string
  config: LedgerRootConfig
  claims: Claim[]
  bindings: EvidenceBinding[]
  turns: Turn[]
  graph: CodebaseGraph | null
  policy: LayerPolicy | null
  results: ResultsFile | null
}
