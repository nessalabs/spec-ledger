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
}

export type TurnStatus = "open" | "closed"
export type TurnFileKind = "added" | "modified" | "deleted" | "renamed"

export interface TurnFileChange {
  path: string
  kind: TurnFileKind
  additions?: number
  deletions?: number
}

export interface TurnIntent {
  userPrompt: string
  restatedGoal: string
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
    producedAt?: string
  }
  schemaSurfaceChanged: boolean
}

export interface Turn {
  schemaVersion: 1
  id: string
  status: TurnStatus
  openedAt: string
  closedAt?: string
  intent: TurnIntent
  facts?: TurnFacts
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
