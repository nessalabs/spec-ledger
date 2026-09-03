import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot } from "../fs/load.js"
import type { LedgerRootConfig, ProposedClaim, Theme } from "../types.js"

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function loadConfig(rootDir: string): LedgerRootConfig {
  return readJson<LedgerRootConfig>(join(rootDir, "ledger.json"))
}

export function listProposedClaims(repoRootInput: string): ProposedClaim[] {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const config = loadConfig(rootDir)
  const dir = join(rootDir, config.proposedClaimsDir ?? "proposed-claims")
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson<ProposedClaim>(join(dir, f)))
}

export function listThemes(repoRootInput: string): Theme[] {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const config = loadConfig(rootDir)
  const dir = join(rootDir, config.themesDir ?? "themes")
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson<Theme>(join(dir, f)))
}
