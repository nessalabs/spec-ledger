import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
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

export function findRepoRoot(start: string): string {
  let dir = resolve(start)
  for (;;) {
    if (existsSync(join(dir, ".git")) || existsSync(join(dir, LEDGER_DIR))) return dir
    const parent = dirname(dir)
    if (parent === dir) return resolve(start)
    dir = parent
  }
}

export function ledgerRoot(repoRoot: string): string {
  return join(repoRoot, LEDGER_DIR)
}

export function sha256Stable(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex")
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`
}

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
