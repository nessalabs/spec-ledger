import { mkdirSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot, writeJson } from "../fs/load.js"
import {
  listAttachmentsForTurn,
  listDecisionsForTurn,
  listFlowsForTurn,
  listProbesForTurn,
  listSourcesForTurn,
} from "./load.js"
import type {
  EpisodeAttachment,
  EpisodeDecision,
  EpisodeFlow,
  EpisodeProbe,
  EpisodeSource,
  LedgerRootConfig,
} from "../types.js"

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function collectionDir(
  repoRootInput: string,
  key: keyof LedgerRootConfig,
  fallback: string,
): string {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const config = readJson<LedgerRootConfig>(join(rootDir, "ledger.json"))
  const rel = (config[key] as string | undefined) ?? fallback
  return join(rootDir, rel)
}

function turnCollectionPath(
  repoRoot: string,
  key: keyof LedgerRootConfig,
  fallback: string,
  turnId: string,
  fileStem: string,
): string {
  const dir = join(collectionDir(repoRoot, key, fallback), turnId)
  mkdirSync(dir, { recursive: true })
  return join(dir, `${fileStem}.json`)
}

function nextLocalId(prefix: string, ids: string[]): string {
  const max = ids.reduce((m, id) => {
    const n = Number(id.match(new RegExp(`${prefix}-(\\d+)`))?.[1])
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `${prefix}-${String(max + 1).padStart(2, "0")}`
}

export function writeDecision(
  repoRoot: string,
  decision: Omit<EpisodeDecision, "schemaVersion" | "id"> & { id?: string },
): EpisodeDecision {
  const existing = listDecisionsForTurn(repoRoot, decision.turnId)
  const local = nextLocalId("D", existing.map((d) => d.id))
  const id = decision.id ?? `${decision.turnId}/${local}`
  const full: EpisodeDecision = { schemaVersion: 1, ...decision, id }
  const stem = id.includes("/") ? id.split("/").at(-1)! : id
  writeJson(
    turnCollectionPath(repoRoot, "decisionsDir", "decisions", decision.turnId, stem),
    full,
  )
  return full
}

export function writeSource(
  repoRoot: string,
  source: Omit<EpisodeSource, "schemaVersion" | "id"> & { id?: string },
): EpisodeSource {
  const existing = listSourcesForTurn(repoRoot, source.turnId)
  const local = nextLocalId("S", existing.map((s) => s.id))
  const id = source.id ?? `${source.turnId}/${local}`
  const full: EpisodeSource = { schemaVersion: 1, ...source, id }
  const stem = id.includes("/") ? id.split("/").at(-1)! : id
  writeJson(
    turnCollectionPath(repoRoot, "sourcesDir", "sources", source.turnId, stem),
    full,
  )
  return full
}

export function writeAttachment(
  repoRoot: string,
  attachment: Omit<EpisodeAttachment, "schemaVersion" | "id"> & { id?: string },
): EpisodeAttachment {
  const existing = listAttachmentsForTurn(repoRoot, attachment.turnId)
  const local = nextLocalId("A", existing.map((a) => a.id))
  const id = attachment.id ?? `${attachment.turnId}/${local}`
  const full: EpisodeAttachment = { schemaVersion: 1, ...attachment, id }
  const stem = id.includes("/") ? id.split("/").at(-1)! : id
  writeJson(
    turnCollectionPath(repoRoot, "attachmentsDir", "attachments", attachment.turnId, stem),
    full,
  )
  return full
}

export function writeProbe(
  repoRoot: string,
  probe: Omit<EpisodeProbe, "schemaVersion" | "id"> & { id?: string },
): EpisodeProbe {
  const existing = listProbesForTurn(repoRoot, probe.turnId)
  const local = nextLocalId("P", existing.map((p) => p.id))
  const id = probe.id ?? `${probe.turnId}/${local}`
  const full: EpisodeProbe = { schemaVersion: 1, ...probe, id }
  const stem = id.includes("/") ? id.split("/").at(-1)! : id
  writeJson(
    turnCollectionPath(repoRoot, "probesDir", "probes", probe.turnId, stem),
    full,
  )
  return full
}

export function writeFlow(
  repoRoot: string,
  flow: Omit<EpisodeFlow, "schemaVersion" | "id"> & { id?: string },
): EpisodeFlow {
  const existing = listFlowsForTurn(repoRoot, flow.turnId)
  const local = nextLocalId("F", existing.map((f) => f.id))
  const id = flow.id ?? `${flow.turnId}/${local}`
  const full: EpisodeFlow = { schemaVersion: 1, ...flow, id }
  const stem = id.includes("/") ? id.split("/").at(-1)! : id
  writeJson(
    turnCollectionPath(repoRoot, "flowsDir", "flows", flow.turnId, stem),
    full,
  )
  return full
}

export function assertOpenTurn(repoRoot: string, turnId: string): void {
  const path = join(ledgerRoot(findRepoRoot(repoRoot)), "turns", `${turnId}.json`)
  if (!existsSync(path)) throw new Error(`turn not found: ${turnId}`)
  const turn = readJson<{ status: string }>(path)
  if (turn.status !== "open") {
    throw new Error(`turn ${turnId} is ${turn.status} — side records only while open`)
  }
}
