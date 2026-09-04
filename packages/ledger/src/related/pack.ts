import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot, loadLedger } from "../fs/load.js"
import { listProposedClaims } from "../proposed/load.js"
import { loadWorkstream, listWorkstreams } from "../workstream/load.js"
import { backlog } from "../deferrals/index.js"
import type { LedgerRootConfig, RelatedPack } from "../types.js"

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function loadConfig(rootDir: string): LedgerRootConfig {
  return readJson<LedgerRootConfig>(join(rootDir, "ledger.json"))
}

/** Ledger-grounded neighborhood for a workstream (no DIY worktree authority). */
export function getRelatedPack(
  repoRootInput: string,
  workstreamId: string,
  opts?: { worktrees?: boolean },
): RelatedPack {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const ledger = loadLedger(repoRoot)
  const ws = loadWorkstream(repoRoot, workstreamId)
  const featureIds = new Set(ws.featureIds)

  const features = (ledger.graph?.features ?? []).filter((f) => featureIds.has(f.id))
  const claimIds = new Set<string>()
  for (const f of features) for (const c of f.claimIds ?? []) claimIds.add(c)
  for (const id of ws.proposedClaimIds ?? []) claimIds.add(id)
  for (const s of ws.suggestedSlices ?? []) {
    for (const id of s.expectedClaimIds ?? []) claimIds.add(id)
  }

  const claims = ledger.claims.filter((c) => claimIds.has(c.id))
  const proposedClaims = listProposedClaims(repoRoot).filter(
    (p) =>
      (ws.proposedClaimIds ?? []).includes(p.id) || p.workstreamId === workstreamId,
  )

  const turns = ledger.turns
    .filter(
      (t) =>
        t.intent.workstreamId === workstreamId ||
        t.intent.featureIds?.some((f) => featureIds.has(f)) ||
        t.facts?.touchedFeatureIds.some((f) => featureIds.has(f)),
    )
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 20)

  const docs: string[] = []
  const docsRoot = join(repoRoot, "docs")
  if (existsSync(docsRoot)) {
    const walk = (dir: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, name.name)
        if (name.isDirectory()) walk(p)
        else if (name.name.endsWith(".md")) {
          docs.push(p.slice(repoRoot.length + 1))
        }
      }
    }
    walk(docsRoot)
  }
  docs.sort()

  let worktreeCautions: string[] | undefined
  if (opts?.worktrees) {
    worktreeCautions = [
      "worktree scan is caution-only; authority is this checkout — use git worktree list yourself if needed",
    ]
  }

  void loadConfig(rootDir)

  return {
    backlog: backlog(repoRoot, workstreamId),
    relatedWorkstreams: listWorkstreams(repoRoot).filter(w => w.id !== workstreamId && w.featureIds.some(f => featureIds.has(f)))
      .map(w => ({ id: w.id, specPath: w.specPath, reasons: w.featureIds.filter(f => featureIds.has(f)).map(f => `shared feature: ${f}`) })),
    workstreamId,
    features,
    claims,
    proposedClaims,
    turns,
    docs: docs.slice(0, 50),
    worktreeCautions,
  }
}
