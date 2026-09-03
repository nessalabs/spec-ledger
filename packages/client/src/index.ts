/**
 * Transport-agnostic client. UIs and third-party products depend on this —
 * never on @nessa/spec-ledger filesystem APIs or the reference UI.
 *
 * v1: in-process transport (no daemon). HTTP transport talks to read-only server.
 */
import {
  loadLedger,
  verifyLedger,
  blastRadius,
  layerViolations,
  snapshotLedger,
  listSchemaFiles,
  readSchemaFile,
  getVerticalContext,
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
} from "@nessa/spec-ledger"

export type LedgerTransport =
  | { kind: "inProcess"; rootDir: string }
  | { kind: "http"; baseUrl: string }

export interface SpecLedgerClient {
  getSnapshot(): Promise<LedgerSnapshot>
  getClaims(): Promise<Claim[]>
  getBindings(): Promise<EvidenceBinding[]>
  getTurns(): Promise<Turn[]>
  getTurn(id: string): Promise<Turn>
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
      return verifyLedger(load())
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
    httpContract() {
      return HTTP_CONTRACT
    },
  }
}

function http(baseUrl: string): SpecLedgerClient {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  return {
    getSnapshot: () => httpGet(base, "v1/snapshot"),
    getClaims: () => httpGet(base, "v1/claims"),
    getBindings: () => httpGet(base, "v1/bindings"),
    getTurns: () => httpGet(base, "v1/turns"),
    getTurn: (id) => httpGet(base, `v1/turns/${encodeURIComponent(id)}`),
    getGraph: () => httpGet(base, "v1/graph"),
    getPolicy: () => httpGet(base, "v1/policy"),
    getConfig: () => httpGet(base, "v1/config"),
    verify: () => httpGet(base, "v1/verify"),
    getReport: () => httpGet(base, "v1/report"),
    impact: (nodeId) => httpGet(base, `v1/impact/${encodeURIComponent(nodeId)}`),
    layerViolations: () => httpGet(base, "v1/layers/violations"),
    listSchemas: () => httpGet(base, "v1/schemas"),
    getSchema: (name) => httpGet(base, `v1/schemas/${encodeURIComponent(name)}`),
    getVerticalContext: (workstreamId, sliceId) =>
      httpGet(
        base,
        `v1/context?workstream=${encodeURIComponent(workstreamId)}&slice=${encodeURIComponent(sliceId)}`,
      ),
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
  Claim,
  EvidenceBinding,
  CodebaseGraph,
  LayerPolicy,
  VerifyReport,
  LedgerSnapshot,
  LedgerRootConfig,
  Turn,
  VerticalContext,
}
export { HTTP_CONTRACT }
