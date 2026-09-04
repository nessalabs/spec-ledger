import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { LEDGER_DIR, findRepoRoot, writeJson } from "../fs/load.js"

/** Empty dirs created by init (no files other than optional keepers elsewhere). */
export const INIT_EMPTY_DIRS = [
  "claims",
  "bindings",
  "turns",
  "workstreams",
  "proposed-claims",
  "reviews",
  "themes",
  "tenets",
] as const

export type InitLedgerResult = {
  path: string
  warnings: string[]
}

/**
 * Create a full consumer `.spec-ledger/` skeleton.
 * Writes `ledger.json` last so a crash mid-way cannot look initialized.
 */
export function initLedger(cwd: string, name: string): string {
  return initLedgerDetailed(cwd, name).path
}

export function initLedgerDetailed(cwd: string, name: string): InitLedgerResult {
  const repoRoot = findRepoRoot(cwd)
  const root = join(repoRoot, LEDGER_DIR)
  const warnings: string[] = []

  if (existsSync(join(root, "ledger.json"))) {
    throw new Error(`${LEDGER_DIR}/ already initialized at ${root}`)
  }

  if (!existsSync(join(repoRoot, ".git"))) {
    warnings.push(
      `no .git at ${repoRoot}; initialized .spec-ledger here (cwd/repo walk fallback)`,
    )
  }

  // Dirs + non-ledger files first; ledger.json last (re-init gate).
  for (const dir of INIT_EMPTY_DIRS) {
    mkdirSync(join(root, dir), { recursive: true })
  }
  mkdirSync(join(root, "graph"), { recursive: true })
  mkdirSync(join(root, "policy"), { recursive: true })
  mkdirSync(join(root, "results"), { recursive: true })

  writeJson(join(root, "policy/layers.json"), {
    layers: ["core", "application", "interface"],
    allow: {
      interface: ["interface", "application"],
      application: ["application", "core"],
      core: ["core"],
    },
  })

  writeJson(join(root, "graph/codebase-graph.json"), {
    system: {
      name,
      description: "Replace with your system description.",
      revision: "0",
      languages: [],
    },
    layers: [
      { id: "core", name: "Core" },
      { id: "application", name: "Application" },
      { id: "interface", name: "Interface" },
    ],
    features: [],
    nodes: [],
    edges: [],
  })

  writeFileSync(join(root, "results/.gitkeep"), "", "utf8")

  const now = new Date().toISOString()
  writeJson(join(root, "vision.json"), {
    schemaVersion: 1,
    summary: "Replace with your product vision summary.",
    nonGoals: [],
    users: [],
    updatedAt: now,
    updatedBy: "init",
  })

  writeJson(join(root, "ledger.json"), {
    schemaVersion: 1,
    name,
    claimsDir: "claims",
    bindingsDir: "bindings",
    turnsDir: "turns",
    workstreamsDir: "workstreams",
    proposedClaimsDir: "proposed-claims",
    graphPath: "graph/codebase-graph.json",
    policyPath: "policy/layers.json",
    resultsPath: "results/last.json",
    reportPath: "results/report.json",
  })

  return { path: root, warnings }
}
