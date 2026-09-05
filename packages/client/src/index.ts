/**
 * Transport-agnostic client. UIs and third-party products depend on this —
 * never on @nessalabs/spec-ledger filesystem APIs or the reference UI.
 *
 * v1: in-process transport (no daemon). HTTP transport talks to read-only server.
 */
import {
  getSession,
  getCheckEvidence, getCheckRun, type CheckEvidence, type CheckRun,
  type SessionProjection,
  permissionStatus,
  listLearnings,
  type PermissionStatus,
  type Learning,
  loadLedger,
  verifyLedger,
  blastRadius,
  layerViolations,
  snapshotLedger,
  readStoredReport,
  listSchemaFiles,
  readSchemaFile,
  getVerticalContext,
  getCompass,
  auditLedger,
  listThemes,
  listProposedClaims,
  listAutomationEvents,
  getRelatedPack,
  listWorkstreams,
  loadWorkstream,
  getTurnEpisode,
  HTTP_CONTRACT,
  type LoadedLedger,
  type VerifyReport,
  type CodebaseGraph,
  type Claim,
  type EvidenceBinding,
  type LayerPolicy,
  type LedgerSnapshot,
  type LedgerRootConfig,
  type Turn,
  type VerticalContext,
  type AuditReport,
  type Theme,
  type ProposedClaim,
  type AutomationEvent,
  type RelatedPack,
  type Vision,
  type Tenet,
  type Workstream,
  type TurnEpisode,
} from "@nessalabs/spec-ledger"

export type LedgerTransport =
  | { kind: "inProcess"; rootDir: string }
  | { kind: "http"; baseUrl: string }

export interface SpecLedgerClient {
  getCheckEvidence(bindingId: string): Promise<CheckEvidence>
  getCheckRun(runId: string): Promise<CheckRun>
  getSession(workstreamId?: string): Promise<SessionProjection>
  getPermission(workstreamId:string): Promise<PermissionStatus>
  getLearnings(): Promise<Learning[]>
  getSnapshot(): Promise<LedgerSnapshot>
  getClaims(): Promise<Claim[]>
  getBindings(): Promise<EvidenceBinding[]>
  getTurns(): Promise<Turn[]>
  getTurn(id: string): Promise<Turn>
  getTurnEpisode(id: string): Promise<TurnEpisode>
  getGraph(): Promise<CodebaseGraph | null>
  getPolicy(): Promise<LayerPolicy | null>
  getConfig(): Promise<LedgerRootConfig>
  verify(): Promise<VerifyReport>
  getReport(): Promise<VerifyReport | null>
  impact(nodeId: string): Promise<{ direct: string[]; transitive: string[] }>
  layerViolations(): Promise<
    Array<{ from: string; to: string; fromLayer: string; toLayer: string }>
  >
  listSchemas(): Promise<string[]>
  getSchema(name: string): Promise<unknown>
  getVerticalContext(workstreamId: string, sliceId: string): Promise<VerticalContext>
  getCompass(): Promise<{ vision: Vision | null; tenets: Tenet[]; themes: Theme[] }>
  getAudit(): Promise<AuditReport>
  getThemes(): Promise<Theme[]>
  getProposedClaims(): Promise<ProposedClaim[]>
  getAutomationEvents(): Promise<AutomationEvent[]>
  getRelated(workstreamId: string): Promise<RelatedPack>
  listWorkstreams(): Promise<Workstream[]>
  getWorkstream(id: string): Promise<Workstream>
  httpContract(): typeof HTTP_CONTRACT
}

async function httpGet<T>(baseUrl: string, path: string): Promise<T> {
  const res = await fetch(new URL(path, baseUrl))
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return (await res.json()) as T
}

function inProcess(rootDir: string): SpecLedgerClient {
  const load = (): LoadedLedger => loadLedger(rootDir)
  return {
    async getCheckEvidence(id) { return getCheckEvidence(rootDir,id) },
    async getCheckRun(id) { return getCheckRun(rootDir,id) },
    async getSession(id) { return getSession(rootDir, id) },
    async getPermission(id) { return permissionStatus(rootDir,id) },
    async getLearnings() { return listLearnings(rootDir) },
    async getSnapshot() {
      return snapshotLedger(load())
    },
    async getClaims() {
      return load().claims
    },
    async getBindings() {
      return load().bindings
    },
    async getTurns() {
      return load().turns
    },
    async getTurn(id) {
      const turn = load().turns.find((t) => t.id === id)
      if (!turn) throw new Error(`turn not found: ${id}`)
      return turn
    },
    async getTurnEpisode(id) {
      return getTurnEpisode(rootDir, id)
    },
    async getGraph() {
      return load().graph
    },
    async getPolicy() {
      return load().policy
    },
    async getConfig() {
      return load().config
    },
    async verify() {
      return verifyLedger(load())
    },
    async getReport() {
      return readStoredReport(load())
    },
    async impact(nodeId) {
      const g = load().graph
      if (!g) throw new Error("no graph")
      return blastRadius(g, nodeId)
    },
    async layerViolations() {
      const l = load()
      if (!l.graph || !l.policy) return []
      return layerViolations(l.graph, l.policy.allow)
    },
    async listSchemas() {
      return listSchemaFiles(rootDir)
    },
    async getSchema(name) {
      return readSchemaFile(rootDir, name)
    },
    async getVerticalContext(workstreamId, sliceId) {
      return getVerticalContext(rootDir, workstreamId, sliceId)
    },
    async getCompass() {
      return getCompass(rootDir)
    },
    async getAudit() {
      return auditLedger(rootDir)
    },
    async getThemes() {
      return listThemes(rootDir)
    },
    async getProposedClaims() {
      return listProposedClaims(rootDir)
    },
    async getAutomationEvents() {
      return listAutomationEvents(rootDir)
    },
    async getRelated(workstreamId) {
      return getRelatedPack(rootDir, workstreamId)
    },
    async listWorkstreams() {
      return listWorkstreams(rootDir)
    },
    async getWorkstream(id) {
      return loadWorkstream(rootDir, id)
    },
    httpContract() {
      return HTTP_CONTRACT
    },
  }
}

function http(baseUrl: string): SpecLedgerClient {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  return {
    getCheckEvidence: (id) => httpGet(base, `v1/check-evidence?bindingId=${encodeURIComponent(id)}`),
    getCheckRun: (id) => httpGet(base, `v1/check-run?runId=${encodeURIComponent(id)}`),
    getSession: (id) => httpGet(base, `v1/session${id ? `?workstream=${encodeURIComponent(id)}` : ""}`),
    getPermission: (id) => httpGet(base, `v1/permission?workstream=${encodeURIComponent(id)}`),
    getLearnings: () => httpGet(base,"v1/learnings"),
    getSnapshot: () => httpGet(base, "v1/snapshot"),
    getClaims: () => httpGet(base, "v1/claims"),
    getBindings: () => httpGet(base, "v1/bindings"),
    getTurns: () => httpGet(base, "v1/turns"),
    getTurn: (id) => httpGet(base, `v1/turns/${encodeURIComponent(id)}`),
    getTurnEpisode: (id) =>
      httpGet(base, `v1/turns/${encodeURIComponent(id)}/episode`),
    getGraph: () => httpGet(base, "v1/graph"),
    getPolicy: () => httpGet(base, "v1/policy"),
    getConfig: () => httpGet(base, "v1/config"),
    verify: () => httpGet(base, "v1/verify"),
    getReport: async () => {
      const response = await fetch(new URL("v1/report", base))
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`v1/report: ${response.status}`)
      return await response.json() as VerifyReport
    },
    impact: (nodeId) => httpGet(base, `v1/impact/${encodeURIComponent(nodeId)}`),
    layerViolations: () => httpGet(base, "v1/layers/violations"),
    listSchemas: () => httpGet(base, "v1/schemas"),
    getSchema: (name) => httpGet(base, `v1/schemas/${encodeURIComponent(name)}`),
    getVerticalContext: (workstreamId, sliceId) =>
      httpGet(
        base,
        `v1/context?workstream=${encodeURIComponent(workstreamId)}&slice=${encodeURIComponent(sliceId)}`,
      ),
    getCompass: () => httpGet(base, "v1/compass"),
    getAudit: () => httpGet(base, "v1/audit"),
    getThemes: () => httpGet(base, "v1/themes"),
    getProposedClaims: () => httpGet(base, "v1/proposed-claims"),
    getAutomationEvents: () => httpGet(base, "v1/automation-events"),
    getRelated: (workstreamId) =>
      httpGet(base, `v1/related?workstream=${encodeURIComponent(workstreamId)}`),
    listWorkstreams: () => httpGet(base, "v1/workstreams"),
    getWorkstream: (id) =>
      httpGet(base, `v1/workstreams/${encodeURIComponent(id)}`),
    httpContract() {
      return HTTP_CONTRACT
    },
  }
}

export function createSpecLedgerClient(transport: LedgerTransport): SpecLedgerClient {
  if (transport.kind === "inProcess") return inProcess(transport.rootDir)
  return http(transport.baseUrl)
}

export type {
  SessionProjection,
  PermissionStatus,
  Learning,
  Claim,
  EvidenceBinding,
  CodebaseGraph,
  LayerPolicy,
  VerifyReport,
  LedgerSnapshot,
  LedgerRootConfig,
  Turn,
  VerticalContext,
  AuditReport,
  Theme,
  ProposedClaim,
  AutomationEvent,
  RelatedPack,
  Vision,
  Tenet,
  Workstream,
  TurnEpisode,
}
export { HTTP_CONTRACT }
export { graphDisplayIssue } from "./graph-shape.js"
export { createLocalApprovalBridge } from "@nessalabs/spec-ledger"

export { createLocalCheckBridge, type CheckEvidence, type CheckRun } from "@nessalabs/spec-ledger"

export { createLocalWorkflowBridge, type WorkflowOptions, type WorkflowProfile, type WorkflowProfileStage, type WorkflowProfileStep, type WorkflowOutputKind, type WorkflowStageRole, type WorkflowSnapshot } from "@nessalabs/spec-ledger"
