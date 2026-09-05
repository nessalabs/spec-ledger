import { permissionStatus } from "../permission/authority.js"
import { applicableLearnings } from "../compass/learnings.js"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { listAutomationEvents } from "../automation/load.js"
import { listDecisionsForTurn } from "../episodes/load.js"
import { listProposedClaims } from "../proposed/load.js"
import { blastRadius } from "../graph/impact.js"
import { findRepoRoot, ledgerRoot, loadLedger, sha256Stable } from "../fs/load.js"
import {
  loadSealSnapshot,
  loadWorkstream,
} from "../workstream/load.js"
import type {
  Claim,
  EvidenceBinding,
  GraphNode,
  Tenet,
  VerticalContext,
  Vision,
  WorkstreamSlice,
} from "../types.js"

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function loadVision(rootDir: string, visionPath?: string): Vision | null {
  const path = join(rootDir, visionPath ?? "vision.json")
  if (!existsSync(path)) return null
  return readJson<Vision>(path)
}

function loadTenets(rootDir: string, tenetsDir?: string): Tenet[] {
  const dir = join(rootDir, tenetsDir ?? "tenets")
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson<Tenet>(join(dir, f)))
    .filter((t) => t.status === "active")
}

export function getVerticalContext(
  repoRootInput: string,
  workstreamId: string,
  sliceId: string,
): VerticalContext {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const ledger = loadLedger(repoRoot)
  const ws = loadWorkstream(repoRoot, workstreamId)
  if (!ws.seal || (ws.status !== "sealed" && ws.status !== "active" && ws.status !== "done")) {
    throw new Error(
      `workstream ${workstreamId} must be sealed (or active/done) before context`,
    )
  }
  const slice = (ws.suggestedSlices ?? []).find((s) => s.id === sliceId)
  if (!slice) throw new Error(`slice ${sliceId} not found on ${workstreamId}`)

  const snapshot = loadSealSnapshot(repoRoot, ws)
  const featureIds = new Set(ws.featureIds)
  const expected = new Set(slice.expectedClaimIds ?? [])

  const liveClaims: Claim[] = ledger.claims.filter((c) => {
    if (expected.has(c.id)) return true
    const feat = ledger.graph?.features.find((f) => featureIds.has(f.id))
    return feat?.claimIds?.includes(c.id) ?? false
  })
  // Also include claims on feature meta for all featureIds
  for (const f of ledger.graph?.features ?? []) {
    if (!featureIds.has(f.id)) continue
    for (const cid of f.claimIds ?? []) {
      const claim = ledger.claims.find((c) => c.id === cid)
      if (claim && !liveClaims.some((x) => x.id === claim.id)) liveClaims.push(claim)
    }
  }
  liveClaims.sort((a, b) => a.id.localeCompare(b.id))

  const claimIdSet = new Set(liveClaims.map((c) => c.id))
  const bindings: EvidenceBinding[] = ledger.bindings.filter((b) =>
    claimIdSet.has(b.claimId),
  )

  const nodes: GraphNode[] = (ledger.graph?.nodes ?? []).filter((n) =>
    (n.featureIds ?? []).some((f) => featureIds.has(f)),
  )
  const direct = new Set<string>()
  const transitive = new Set<string>()
  if (ledger.graph) {
    for (const n of nodes) {
      direct.add(n.id)
      const r = blastRadius(ledger.graph, n.id)
      for (const id of r.direct) direct.add(id)
      for (const id of r.transitive) transitive.add(id)
    }
  }

  const priorTurns = ledger.turns
    .filter(
      (t) =>
        t.intent.workstreamId === workstreamId ||
        t.intent.featureIds?.some((f) => featureIds.has(f)) ||
        t.intent.claimedFeatureIds?.some((f) => featureIds.has(f)) ||
        t.facts?.touchedFeatureIds.some((f) => featureIds.has(f)),
    )
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 10)

  const decisions = priorTurns.flatMap((t) =>
    listDecisionsForTurn(repoRoot, t.id),
  ).slice(0, 20)

  const proposed = listProposedClaims(repoRoot).filter(
    (p) =>
      (ws.proposedClaimIds ?? []).includes(p.id) || p.workstreamId === workstreamId,
  )

  const automation = {
    open: listAutomationEvents(repoRoot).filter((e) =>
      (!e.workstreamId || e.workstreamId === workstreamId) &&
      (e.state === "waiting" || e.state === "blocked")),
    recent: [],
  }

  const vision = loadVision(rootDir, ledger.config.visionPath)
  const learnings = applicableLearnings(repoRoot,workstreamId,ws.featureIds)
  const supersededTenets = new Set(learnings.flatMap(l=>l.supersedesTenetIds ?? []))
  const tenets = loadTenets(rootDir, ledger.config.tenetsDir).filter(t=>
    !supersededTenets.has(t.id) && (!t.scope || t.scope === "product" || ws.featureIds.includes(t.scope) || ws.featureIds.includes(t.scope.replace(/^feature:/,""))))

  const seal = {
    ...ws.seal,
    snapshot,
  }

  const draft = {
    obligations: evaluateDeferrals(repoRoot, workstreamId).filter(o => o.affected),
    permission: permissionStatus(repoRoot,workstreamId),
    learnings,
    vision,
    tenets,
    workstream: ws,
    seal,
    slice: slice as WorkstreamSlice,
    claims: { live: liveClaims, proposed, bindings },
    prior: {
      turns: priorTurns,
      decisions,
      openAutomationEvents: automation.open,
      recentAutomationEvents: automation.recent,
    },
    graph: {
      nodes,
      predictedBlastRadius: {
        direct: [...direct].sort(),
        transitive: [...transitive].sort(),
      },
    },
    policy: ws.policy,
    trust: ws.trust,
    truncation: {
      decisions: decisions.length,
      turns: priorTurns.length,
      note: "prior capped at 10 turns / 20 decisions",
    },
  }

  const contextDigest = sha256Stable(draft)
  return {
    ...draft,
    contextDigest,
    generatedAt: new Date().toISOString(),
  }
}
import { evaluateDeferrals } from "../deferrals/index.js"
