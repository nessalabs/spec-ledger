import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot, sha256Stable } from "../fs/load.js"
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

function loadConfig(rootDir: string): LedgerRootConfig {
  return readJson<LedgerRootConfig>(join(rootDir, "ledger.json"))
}

function collectionDir(
  repoRootInput: string,
  key: keyof LedgerRootConfig,
  fallback: string,
): string {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const config = loadConfig(rootDir)
  const rel = (config[key] as string | undefined) ?? fallback
  return join(rootDir, rel)
}

function listJsonDir<T>(dir: string): T[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson<T>(join(dir, f)))
}

function listTurnScoped<T extends { turnId: string }>(
  dir: string,
  turnId: string,
): T[] {
  // Flat files or turnId/ subdir
  const nested = join(dir, turnId)
  if (existsSync(nested)) {
    return listJsonDir<T>(nested).filter((x) => x.turnId === turnId || !x.turnId)
  }
  return listJsonDir<T>(dir).filter((x) => x.turnId === turnId)
}

export function listDecisionsForTurn(repoRoot: string, turnId: string): EpisodeDecision[] {
  return listTurnScoped(
    collectionDir(repoRoot, "decisionsDir", "decisions"),
    turnId,
  )
}

export function listSourcesForTurn(repoRoot: string, turnId: string): EpisodeSource[] {
  return listTurnScoped(collectionDir(repoRoot, "sourcesDir", "sources"), turnId)
}

export function listAttachmentsForTurn(
  repoRoot: string,
  turnId: string,
): EpisodeAttachment[] {
  return listTurnScoped(
    collectionDir(repoRoot, "attachmentsDir", "attachments"),
    turnId,
  )
}

export function listProbesForTurn(repoRoot: string, turnId: string): EpisodeProbe[] {
  return listTurnScoped(collectionDir(repoRoot, "probesDir", "probes"), turnId)
}

export function listFlowsForTurn(repoRoot: string, turnId: string): EpisodeFlow[] {
  return listTurnScoped(collectionDir(repoRoot, "flowsDir", "flows"), turnId)
}

export function episodeDigestsForTurn(repoRoot: string, turnId: string) {
  const decisions = listDecisionsForTurn(repoRoot, turnId)
  const sources = listSourcesForTurn(repoRoot, turnId)
  const attachments = listAttachmentsForTurn(repoRoot, turnId)
  const probes = listProbesForTurn(repoRoot, turnId)
  const flows = listFlowsForTurn(repoRoot, turnId)
  return {
    decisionIds: decisions.map((d) => d.id).sort(),
    decisionsDigest: decisions.length ? sha256Stable(decisions) : undefined,
    sourcesDigest: sources.length ? sha256Stable(sources) : undefined,
    attachmentsDigest: attachments.length ? sha256Stable(attachments) : undefined,
    probesDigest: probes.length ? sha256Stable(probes) : undefined,
    flowsDigest: flows.length ? sha256Stable(flows) : undefined,
  }
}
