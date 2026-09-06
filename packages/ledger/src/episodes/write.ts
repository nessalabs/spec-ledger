import { listDecisionsForTurn } from "./load.js"
import { assertEntityId, createEntityId, publishEntity } from "../identity/index.js"
import { mkdirSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot } from "../fs/load.js"
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


export function writeDecision(
  repoRoot: string,
  decision: Omit<EpisodeDecision, "schemaVersion" | "id"> & { id?: string },
): EpisodeDecision {
  assertEntityId(decision.turnId, "turn id")
  const id = decision.id ?? createEntityId()
  assertEntityId(id)
  const full: EpisodeDecision = { schemaVersion: 1, ...decision, id, recordedAt: new Date().toISOString(), sequence: Math.max(0,...listDecisionsForTurn(repoRoot, decision.turnId).map(d=>d.sequence ?? 0)) + 1 }
  const stem = id.includes("/") ? id.split("/").at(-1)! : id
  publishEntity(
    turnCollectionPath(repoRoot, "decisionsDir", "decisions", decision.turnId, stem),
    full,
  )
  return full
}

export function writeSource(
  repoRoot: string,
  source: Omit<EpisodeSource, "schemaVersion" | "id"> & { id?: string },
): EpisodeSource {
  assertEntityId(source.turnId, "turn id")
  const id = source.id ?? createEntityId()
  assertEntityId(id)
  const full: EpisodeSource = { schemaVersion: 1, ...source, id }
  const stem = id.includes("/") ? id.split("/").at(-1)! : id
  publishEntity(
    turnCollectionPath(repoRoot, "sourcesDir", "sources", source.turnId, stem),
    full,
  )
  return full
}

export function writeAttachment(
  repoRoot: string,
  attachment: Omit<EpisodeAttachment, "schemaVersion" | "id"> & { id?: string },
): EpisodeAttachment {
  assertEntityId(attachment.turnId, "turn id")
  const id = attachment.id ?? createEntityId()
  assertEntityId(id)
  const full: EpisodeAttachment = { schemaVersion: 1, ...attachment, id }
  const stem = id.includes("/") ? id.split("/").at(-1)! : id
  publishEntity(
    turnCollectionPath(repoRoot, "attachmentsDir", "attachments", attachment.turnId, stem),
    full,
  )
  return full
}

export function writeProbe(
  repoRoot: string,
  probe: Omit<EpisodeProbe, "schemaVersion" | "id"> & { id?: string },
): EpisodeProbe {
  assertEntityId(probe.turnId, "turn id")
  const id = probe.id ?? createEntityId()
  assertEntityId(id)
  const full: EpisodeProbe = { schemaVersion: 1, ...probe, id }
  const stem = id.includes("/") ? id.split("/").at(-1)! : id
  publishEntity(
    turnCollectionPath(repoRoot, "probesDir", "probes", probe.turnId, stem),
    full,
  )
  return full
}

export function writeFlow(
  repoRoot: string,
  flow: Omit<EpisodeFlow, "schemaVersion" | "id"> & { id?: string },
): EpisodeFlow {
  assertEntityId(flow.turnId, "turn id")
  const id = flow.id ?? createEntityId()
  assertEntityId(id)
  const full: EpisodeFlow = { schemaVersion: 1, ...flow, id }
  const stem = id.includes("/") ? id.split("/").at(-1)! : id
  publishEntity(
    turnCollectionPath(repoRoot, "flowsDir", "flows", flow.turnId, stem),
    full,
  )
  return full
}

export function assertOpenTurn(repoRoot: string, turnId: string): void {
  assertEntityId(turnId, "turn id")
  const path = join(ledgerRoot(findRepoRoot(repoRoot)), "turns", `${turnId}.json`)
  if (!existsSync(path)) throw new Error(`turn not found: ${turnId}`)
  const turn = readJson<{ status: string }>(path)
  if (turn.status !== "open") {
    throw new Error(`turn ${turnId} is ${turn.status} — side records only while open`)
  }
}
