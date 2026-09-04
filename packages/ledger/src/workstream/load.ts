import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot, sha256Stable, writeJson } from "../fs/load.js"
import type {
  LedgerRootConfig,
  PostSealAmend,
  Workstream,
  WorkstreamSeal,
} from "../types.js"
import {
  appendPostSealAmend,
  checkSpecDocDigest,
  lastExpectedDocDigest,
  readSpecDocDigest,
} from "./doc-digest.js"

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
  let specDocDigest: string | undefined
  if (ws.specPath) {
    const live = readSpecDocDigest(repoRoot, ws)
    if (!live) throw new Error(`specPath set but unreadable: ${ws.specPath}`)
    specDocDigest = live.digest
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
    ...(specDocDigest ? { specDocDigest } : {}),
    body: sealPayload(ws),
  }
  writeJson(join(rootDir, snapshotPath), snapshot)
  const seal: WorkstreamSeal = {
    sealedAt,
    sealedBy,
    specDigest: digest,
    snapshotPath,
    revision,
    ...(specDocDigest ? { specDocDigest } : {}),
  }
  const next: Workstream = {
    ...ws,
    // Keep terminal / in-progress statuses; only force sealed when entering from pre-seal.
    status:
      ws.status === "done" || ws.status === "active" ? ws.status : "sealed",
    updatedAt: sealedAt,
    seal,
  }
  writeWorkstream(repoRoot, next)
  return next
}

/**
 * Upgrade path for any consumer: sealed + specPath but no expected digest.
 * Writes a new seal revision with specDocDigest; does not mutate old seals/N.json.
 */
export function backfillDocDigest(
  repoRootInput: string,
  id: string,
  by: string,
): Workstream {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const ws = loadWorkstream(repoRoot, id)
  if (!ws.seal) throw new Error(`workstream ${id} is not sealed`)
  if (!ws.specPath) {
    throw new Error(`workstream ${id} has no specPath — nothing to backfill`)
  }
  if (lastExpectedDocDigest(ws)) {
    return ws // idempotent
  }
  const live = readSpecDocDigest(repoRoot, ws)
  if (!live) throw new Error(`specPath missing: ${ws.specPath}`)
  const prevSnap = readJson<{
    body: Record<string, unknown>
    specDigest: string
  }>(join(rootDir, ws.seal.snapshotPath))
  const revision = ws.seal.revision + 1
  const sealedAt = new Date().toISOString()
  const snapshotPath = `workstreams/${id}.seals/${revision}.json`
  const snapshot = {
    schemaVersion: 1,
    workstreamId: id,
    revision,
    sealedAt,
    sealedBy: by,
    specDigest: prevSnap.specDigest,
    specDocDigest: live.digest,
    body: prevSnap.body,
    backfillOfRevision: ws.seal.revision,
    backfillReason: "stamp specDocDigest for sealed specPath",
  }
  writeJson(join(rootDir, snapshotPath), snapshot)
  const seal: WorkstreamSeal = {
    ...ws.seal,
    sealedAt,
    sealedBy: by,
    snapshotPath,
    revision,
    specDocDigest: live.digest,
  }
  const next: Workstream = { ...ws, updatedAt: sealedAt, seal }
  writeWorkstream(repoRoot, next)
  return next
}

export function amendWorkstream(
  repoRootInput: string,
  id: string,
  args: {
    summary: string
    by: string
    turnId?: string
    decisionId?: string
    commit?: string
  },
): { workstream: Workstream; amend: PostSealAmend } {
  const repoRoot = findRepoRoot(repoRootInput)
  const ws = loadWorkstream(repoRoot, id)
  if (!ws.seal) {
    throw new Error(`workstream ${id} has no seal — seal before amend`)
  }
  if (!ws.specPath) {
    throw new Error(`workstream ${id} has no specPath`)
  }
  const expected = lastExpectedDocDigest(ws)
  if (!expected) {
    throw new Error(
      `no expected doc digest — run: spec-ledger workstream backfill-doc-digest ${id} --by ${args.by}`,
    )
  }
  const live = readSpecDocDigest(repoRoot, ws)
  if (!live) throw new Error(`specPath missing: ${ws.specPath}`)
  if (live.digest === expected) {
    throw new Error(
      `workstream amend refused: no byte change (before === after ${expected.slice(0, 12)}…)`,
    )
  }
  if (!/^[a-f0-9]{64}$/i.test(live.digest)) {
    throw new Error("workstream amend refused: invalid afterDocDigest")
  }
  const amend: PostSealAmend = {
    at: new Date().toISOString(),
    summary: args.summary,
    humanConfirmed: true,
    sealedRevision: ws.seal.revision,
    beforeDocDigest: expected,
    afterDocDigest: live.digest,
    actor: args.by,
    ...(args.turnId ? { turnId: args.turnId } : {}),
    ...(args.decisionId ? { decisionId: args.decisionId } : {}),
    ...(args.commit ? { commit: args.commit } : {}),
  }
  const next = appendPostSealAmend(ws, amend)
  writeWorkstream(repoRoot, next)
  return { workstream: next, amend }
}

export function checkSeal(repoRootInput: string, id: string): {
  ok: boolean
  expected: string
  actual: string
  snapshotPath?: string
  doc?: ReturnType<typeof checkSpecDocDigest>
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
  const jsonOk =
    expected === ws.seal.specDigest && snap.specDigest === ws.seal.specDigest
  const doc = checkSpecDocDigest(repoRoot, ws)
  const ok = jsonOk && doc.ok
  return {
    ok,
    expected,
    actual: ws.seal.specDigest,
    snapshotPath: ws.seal.snapshotPath,
    doc,
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

export {
  checkSpecDocDigest,
  lastExpectedDocDigest,
  sha256FileBytes,
} from "./doc-digest.js"
