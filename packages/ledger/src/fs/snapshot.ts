import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { LoadedLedger, VerifyReport } from "../types.js"
import { verifyLedger } from "../verify/verify.js"

export interface LedgerSnapshot {
  config: LoadedLedger["config"]
  claims: LoadedLedger["claims"]
  bindings: LoadedLedger["bindings"]
  turns: LoadedLedger["turns"]
  graph: LoadedLedger["graph"]
  policy: LoadedLedger["policy"]
  report: VerifyReport
}

export function snapshotLedger(ledger: LoadedLedger): LedgerSnapshot {
  return {
    config: ledger.config,
    claims: ledger.claims,
    bindings: ledger.bindings,
    turns: ledger.turns,
    graph: ledger.graph,
    policy: ledger.policy,
    report: verifyLedger(ledger),
  }
}

/** Protocol / schema contracts living next to the tool (repo `schemas/`). */
export function listSchemaFiles(repoRoot: string): string[] {
  const dir = join(repoRoot, "schemas")
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
}

export function readSchemaFile(repoRoot: string, name: string): unknown {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "")
  const path = join(repoRoot, "schemas", safe)
  if (!existsSync(path)) throw new Error(`schema not found: ${safe}`)
  return JSON.parse(readFileSync(path, "utf8"))
}

/** Documented HTTP surface (read-only). Kept in sync with server routes. */
export const HTTP_CONTRACT = [
  { method: "GET", path: "/v1/health", description: "Liveness" },
  { method: "GET", path: "/v1/contract", description: "This HTTP route table" },
  { method: "GET", path: "/v1/snapshot", description: "Claims, bindings, graph, policy, fresh verify report" },
  { method: "GET", path: "/v1/config", description: "Ledger root config" },
  { method: "GET", path: "/v1/claims", description: "All claims" },
  { method: "GET", path: "/v1/bindings", description: "All evidence bindings" },
  { method: "GET", path: "/v1/graph", description: "Codebase graph" },
  { method: "GET", path: "/v1/policy", description: "Layer policy" },
  { method: "GET", path: "/v1/verify", description: "Run verify; write report; return it" },
  { method: "GET", path: "/v1/report", description: "Last written report (404 if none)" },
  { method: "GET", path: "/v1/impact/:nodeId", description: "Blast radius" },
  { method: "GET", path: "/v1/layers/violations", description: "Illegal cross-layer edges" },
  { method: "GET", path: "/v1/schemas", description: "List JSON Schema contract files" },
  { method: "GET", path: "/v1/schemas/:name", description: "One schema document" },
  { method: "GET", path: "/v1/turns", description: "Turn change log (intent + close facts)" },
  { method: "GET", path: "/v1/turns/:id", description: "One turn by id" },
] as const
