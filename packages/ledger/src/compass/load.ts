import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot } from "../fs/load.js"
import { listThemes } from "../proposed/load.js"
import type { LedgerRootConfig, Tenet, Theme, Vision } from "../types.js"

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

export function getCompass(repoRootInput: string): {
  vision: Vision | null
  tenets: Tenet[]
  themes: Theme[]
} {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const config = readJson<LedgerRootConfig>(join(rootDir, "ledger.json"))
  const visionPath = join(rootDir, config.visionPath ?? "vision.json")
  const vision = existsSync(visionPath) ? readJson<Vision>(visionPath) : null
  const tenetsDir = join(rootDir, config.tenetsDir ?? "tenets")
  const tenets = existsSync(tenetsDir)
    ? readdirSync(tenetsDir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => readJson<Tenet>(join(tenetsDir, f)))
        .filter((t) => t.status === "active")
    : []
  return { vision, tenets, themes: listThemes(repoRoot) }
}
