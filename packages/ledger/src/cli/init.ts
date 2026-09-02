import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { LEDGER_DIR, findRepoRoot, writeJson } from "../fs/load.js"

export function initLedger(cwd: string, name: string): string {
  const repoRoot = findRepoRoot(cwd)
  const root = join(repoRoot, LEDGER_DIR)
  if (existsSync(join(root, "ledger.json"))) {
    throw new Error(`${LEDGER_DIR}/ already initialized at ${root}`)
  }

  mkdirSync(join(root, "claims"), { recursive: true })
  mkdirSync(join(root, "bindings"), { recursive: true })
  mkdirSync(join(root, "graph"), { recursive: true })
  mkdirSync(join(root, "policy"), { recursive: true })
  mkdirSync(join(root, "results"), { recursive: true })
  mkdirSync(join(root, "turns"), { recursive: true })

  writeJson(join(root, "ledger.json"), {
    schemaVersion: 1,
    name,
    claimsDir: "claims",
    bindingsDir: "bindings",
    turnsDir: "turns",
    graphPath: "graph/codebase-graph.json",
    policyPath: "policy/layers.json",
    resultsPath: "results/last.json",
    reportPath: "results/report.json",
  })

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

  writeFileSync(
    join(root, "results/.gitkeep"),
    "",
    "utf8",
  )

  return root
}
