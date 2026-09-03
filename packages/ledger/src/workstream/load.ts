import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot, sha256Stable, writeJson } from "../fs/load.js"
import type { LedgerRootConfig, Workstream, WorkstreamSeal } from "../types.js"

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function loadConfig(rootDir: string): LedgerRootConfig {
  return readJson<LedgerRootConfig>(join(rootDir, "ledger.json"))
}

export function workstreamsDir(repoRootInput: string): string {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const config = loadConfig(rootDir)
  return join(rootDir, config.workstreamsDir ?? "workstreams")
}

export function listWorkstreams(repoRootInput: string): Workstream[] {
  const dir = workstreamsDir(repoRootInput)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /^W-.+\.json$/.test(f))
    .sort()
    .map((f) => readJson<Workstream>(join(dir, f)))
}

export function loadWorkstream(repoRootInput: string, id: string): Workstream {
  const path = join(workstreamsDir(repoRootInput), `${id}.json`)
  if (!existsSync(path)) throw new Error(`workstream not found: ${id}`)
  return readJson<Workstream>(path)
}

/** Body hashed into seal.specDigest — excludes live status churn after seal. */
export function sealPayload(ws: Workstream): Record<string, unknown> {
  return {
    id: ws.id,
    featureIds: ws.featureIds,
    primaryFeatureId: ws.primaryFeatureId ?? null,
    title: ws.title,
    problem: ws.problem,
    objective: ws.objective,
    specPath: ws.specPath ?? null,
    appetite: ws.appetite ?? null,
    changeType: ws.changeType ?? null,
    riskLevel: ws.riskLevel ?? null,
    trust: ws.trust ?? null,
    policy: ws.policy ?? null,
    acceptanceCriteria: ws.acceptanceCriteria ?? [],
    outOfScope: ws.outOfScope ?? [],
    proposedClaimIds: ws.proposedClaimIds ?? [],
    suggestedSlices: (ws.suggestedSlices ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      kind: s.kind,
      acceptance: s.acceptance,
      evidence: s.evidence ?? [],
      expectedClaimIds: s.expectedClaimIds ?? [],
      expectedPaths: s.expectedPaths ?? [],
    })),
  }
}

export function computeSpecDigest(ws: Workstream): string {
  return sha256Stable(sealPayload(ws))
}

export function writeWorkstream(repoRootInput: string, ws: Workstream): string {
  const path = join(workstreamsDir(repoRootInput), `${ws.id}.json`)
  writeJson(path, ws)
  return path
}

export function sealWorkstream(
  repoRootInput: string,
  id: string,
  sealedBy: string,
): Workstream {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const ws = loadWorkstream(repoRoot, id)
  if (ws.status === "draft" || ws.status === "cancelled") {
    throw new Error(`workstream ${id} status ${ws.status} cannot seal`)
  }
  const revision = (ws.seal?.revision ?? 0) + 1
  const digest = computeSpecDigest(ws)
  const snapshotPath = `workstreams/${id}.seals/${revision}.json`
  const sealedAt = new Date().toISOString()
  const snapshot = {
    schemaVersion: 1,
    workstreamId: id,
    revision,
    sealedAt,
    sealedBy,
    specDigest: digest,
    body: sealPayload(ws),
  }
  writeJson(join(rootDir, snapshotPath), snapshot)
  const seal: WorkstreamSeal = {
    sealedAt,
    sealedBy,
    specDigest: digest,
    snapshotPath,
    revision,
  }
  const next: Workstream = {
    ...ws,
    status: "sealed",
    updatedAt: sealedAt,
    seal,
  }
  writeWorkstream(repoRoot, next)
  return next
}

export function checkSeal(repoRootInput: string, id: string): {
  ok: boolean
  expected: string
  actual: string
  snapshotPath?: string
} {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const ws = loadWorkstream(repoRoot, id)
  if (!ws.seal) {
    return { ok: false, expected: "", actual: "missing seal" }
  }
  const expected = computeSpecDigest(ws)
  const snapPath = join(rootDir, ws.seal.snapshotPath)
  if (!existsSync(snapPath)) {
    return {
      ok: false,
      expected,
      actual: "missing snapshot file",
      snapshotPath: ws.seal.snapshotPath,
    }
  }
  const snap = readJson<{ specDigest: string }>(snapPath)
  const ok =
    expected === ws.seal.specDigest && snap.specDigest === ws.seal.specDigest
  return {
    ok,
    expected,
    actual: ws.seal.specDigest,
    snapshotPath: ws.seal.snapshotPath,
  }
}

export function loadSealSnapshot(
  repoRootInput: string,
  ws: Workstream,
): Record<string, unknown> {
  if (!ws.seal) throw new Error(`workstream ${ws.id} is not sealed`)
  const repoRoot = findRepoRoot(repoRootInput)
  const path = join(ledgerRoot(repoRoot), ws.seal.snapshotPath)
  if (!existsSync(path)) {
    throw new Error(`seal snapshot missing: ${ws.seal.snapshotPath}`)
  }
  return readJson(path)
}
