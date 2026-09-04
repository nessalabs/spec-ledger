import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { jcsCanonicalize } from "../jcs.js"
import type {
  CodebaseGraph,
  EvidenceBinding,
  Claim,
  LayerPolicy,
  LedgerRootConfig,
  LoadedLedger,
  ResultsFile,
  Turn,
} from "../types.js"

const LEDGER_DIR = ".spec-ledger"

/**
 * Prefer a git checkout root. Only treat `.spec-ledger/` as the root when it
 * is already initialized (`ledger.json`) and no `.git` exists in ancestors —
 * an empty nested `.spec-ledger` must not hijack init away from the repo root.
 */
export function findRepoRoot(start: string): string {
  const startAbs = resolve(start)
  let dir = startAbs
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  dir = startAbs
  for (;;) {
    if (existsSync(join(dir, LEDGER_DIR, "ledger.json"))) return dir
    const parent = dirname(dir)
    if (parent === dir) return startAbs
    dir = parent
  }
}

export function ledgerRoot(repoRoot: string): string {
  return join(repoRoot, LEDGER_DIR)
}

/** RFC 8785 JCS bytes, then sha256 hex. */
export function sha256Stable(value: unknown): string {
  return createHash("sha256").update(jcsCanonicalize(value), "utf8").digest("hex")
}

export { jcsCanonicalize }

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function loadJsonDir<T>(dir: string): T[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson<T>(join(dir, f)))
}

export function loadLedger(repoRootInput: string): LoadedLedger {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  if (!existsSync(rootDir)) {
    throw new Error(`No ${LEDGER_DIR}/ under ${repoRoot}. Run: spec-ledger init`)
  }
  const configPath = join(rootDir, "ledger.json")
  const config = readJson<LedgerRootConfig>(configPath)
  const claimsDir = join(rootDir, config.claimsDir ?? "claims")
  const bindingsDir = join(rootDir, config.bindingsDir ?? "bindings")
  const graphPath = join(rootDir, config.graphPath ?? "graph/codebase-graph.json")
  const policyPath = join(rootDir, config.policyPath ?? "policy/layers.json")
  const resultsPath = join(rootDir, config.resultsPath ?? "results/last.json")
  const turnsDirectory = join(rootDir, config.turnsDir ?? "turns")

  return {
    rootDir,
    repoRoot,
    config,
    claims: loadJsonDir<Claim>(claimsDir),
    bindings: loadJsonDir<EvidenceBinding>(bindingsDir),
    turns: loadJsonDir<Turn>(turnsDirectory).sort((a, b) => a.id.localeCompare(b.id)),
    graph: existsSync(graphPath) ? readJson<CodebaseGraph>(graphPath) : null,
    policy: existsSync(policyPath) ? readJson<LayerPolicy>(policyPath) : null,
    results: existsSync(resultsPath) ? readJson<ResultsFile>(resultsPath) : null,
  }
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

export function pathExists(repoRoot: string, rel: string): boolean {
  return existsSync(join(repoRoot, rel))
}

export { LEDGER_DIR }
