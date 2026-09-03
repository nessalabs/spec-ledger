import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot, writeJson } from "../fs/load.js"
import type { LedgerRootConfig } from "../types.js"

export interface AlignWaiver {
  schemaVersion: 1
  id: string
  reason: string
  actor: string
  treeDigest: string
  workstreamId?: string
  turnId?: string
  createdAt: string
  paths?: string[]
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

export function waiversDir(repoRootInput: string): string {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const config = readJson<LedgerRootConfig>(join(rootDir, "ledger.json"))
  return join(rootDir, config.alignWaiversDir ?? "align-waivers")
}

export function listAlignWaivers(repoRootInput: string): AlignWaiver[] {
  const dir = waiversDir(repoRootInput)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson<AlignWaiver>(join(dir, f)))
}

export function listAlignWaiversForTurn(
  repoRootInput: string,
  turnId: string,
): AlignWaiver[] {
  return listAlignWaivers(repoRootInput).filter((w) => w.turnId === turnId)
}

export function nextAlignWaiverId(repoRootInput: string, turnId?: string): string {
  const existing = listAlignWaivers(repoRootInput)
  const max = existing.reduce((m, w) => {
    const stem = w.id.includes("/") ? w.id.split("/").at(-1)! : w.id
    const n = Number(stem.replace(/^AW-/, ""))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  const id = `AW-${String(max + 1).padStart(2, "0")}`
  return turnId ? `${turnId}/${id}` : id
}

export function writeAlignWaiver(
  repoRootInput: string,
  waiver: Omit<AlignWaiver, "schemaVersion" | "id" | "createdAt"> & {
    id?: string
    createdAt?: string
  },
  opts: { minReasonChars?: number; maxPerTurn?: number } = {},
): AlignWaiver {
  const minReason = opts.minReasonChars ?? 40
  if (!waiver.reason || waiver.reason.trim().length < minReason) {
    throw new Error(
      `align waiver refused: reason must be >= ${minReason} characters (silence is not skip)`,
    )
  }
  if (!waiver.actor?.trim()) {
    throw new Error("align waiver refused: actor required")
  }
  if (!waiver.treeDigest || waiver.treeDigest.length < 16) {
    throw new Error("align waiver refused: treeDigest required (min 16 chars)")
  }

  const turnId = waiver.turnId
  if (turnId) {
    const max = opts.maxPerTurn ?? 1
    const prior = listAlignWaiversForTurn(repoRootInput, turnId)
    if (prior.length >= max) {
      throw new Error(
        `align waiver refused: turn ${turnId} already has ${prior.length} waiver(s) (max ${max})`,
      )
    }
  }

  const full: AlignWaiver = {
    schemaVersion: 1,
    id: waiver.id ?? nextAlignWaiverId(repoRootInput, turnId),
    reason: waiver.reason.trim(),
    actor: waiver.actor.trim(),
    treeDigest: waiver.treeDigest,
    createdAt: waiver.createdAt ?? new Date().toISOString(),
    ...(waiver.workstreamId ? { workstreamId: waiver.workstreamId } : {}),
    ...(turnId ? { turnId } : {}),
    ...(waiver.paths?.length ? { paths: waiver.paths } : {}),
  }

  const dir = waiversDir(repoRootInput)
  mkdirSync(dir, { recursive: true })
  const fileStem = full.id.includes("/") ? full.id.split("/").at(-1)! : full.id
  writeJson(join(dir, `${fileStem}.json`), full)
  return full
}
