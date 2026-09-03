import { loadLedger } from "../fs/load.js"
import { dirtyPaths, computeTreeDigest, changedPathsSince } from "../git/tree.js"
import { loadWorkstream, listWorkstreams } from "../workstream/load.js"
import { listReviewsForTurn } from "../reviews/load.js"
import type { Turn } from "../types.js"
import {
  checkPathCoverage,
  coverageForTurn,
  type AlignCoverageResult,
} from "./coverage.js"
import { alignApproveSatisfied, alignPolicy } from "./approve.js"
import { listAlignWaiversForTurn, listAlignWaivers } from "./waiver.js"
import { isExemptPath } from "./paths.js"

export interface AlignCheckReport {
  ok: boolean
  treeDigest: string
  turnId?: string
  workstreamId?: string
  coverage: AlignCoverageResult
  satisfiedBy?: "coverage" | "approve" | "waiver"
  message: string
}

function openOrTargetTurn(
  turns: Turn[],
  turnId?: string,
): Turn | undefined {
  if (turnId) {
    const t = turns.find((x) => x.id === turnId)
    if (!t) throw new Error(`turn not found: ${turnId}`)
    return t
  }
  return (
    turns.find((t) => t.status === "open") ??
    [...turns].reverse().find((t) => t.intent.workstreamId)
  )
}

function pathsForAlign(repoRoot: string, turn: Turn | undefined): string[] {
  if (!turn) return dirtyPaths(repoRoot)
  if (turn.status === "closed") {
    const fromFacts = turn.facts?.files?.map((f) => f.path) ?? []
    const dirty = dirtyPaths(repoRoot)
    // Product changes after close (dirty or committed since facts.commit)
    let sinceClose: string[] = []
    if (turn.facts?.commit) {
      sinceClose = changedPathsSince(repoRoot, turn.facts.commit)
    } else if (turn.opened?.baseCommit) {
      sinceClose = changedPathsSince(repoRoot, turn.opened.baseCommit)
    }
    return [...new Set([...fromFacts, ...sinceClose, ...dirty])]
  }
  const paths = changedPathsSince(repoRoot, turn.opened?.baseCommit)
  return paths.length ? paths : dirtyPaths(repoRoot)
}

/**
 * Align check: product paths (turn files or dirty tree) vs sealed plan coverage.
 * OK when uncovered empty OR approve/waiver covers an allowed treeDigest.
 * Does not affect verify.ok.
 */
export function alignCheck(
  repoRoot: string,
  opts: { turnId?: string; workstreamId?: string } = {},
): AlignCheckReport {
  const ledger = loadLedger(repoRoot)
  const treeDigest = computeTreeDigest(ledger.repoRoot)
  const turn = openOrTargetTurn(ledger.turns, opts.turnId)

  let paths: string[]
  try {
    paths = pathsForAlign(ledger.repoRoot, turn)
  } catch (err) {
    return {
      ok: false,
      treeDigest,
      turnId: turn?.id,
      workstreamId: turn?.intent.workstreamId,
      coverage: {
        productPaths: [],
        coveredPaths: [],
        uncoveredPaths: [],
        coverageSource: "user",
        coveredBy: {},
      },
      message: err instanceof Error ? err.message : String(err),
    }
  }

  const workstreamId =
    opts.workstreamId ?? turn?.intent.workstreamId ?? pickActiveWorkstream(repoRoot)
  if (!workstreamId) {
    const coverage = checkPathCoverage({ paths, graph: ledger.graph })
    return {
      ok: coverage.uncoveredPaths.length === 0,
      treeDigest,
      coverage,
      satisfiedBy: coverage.uncoveredPaths.length === 0 ? "coverage" : undefined,
      message:
        coverage.uncoveredPaths.length === 0
          ? "no workstream; no product paths uncovered (or none to check)"
          : `no workstream bound; uncovered: ${coverage.uncoveredPaths.join(", ")}`,
    }
  }

  const workstream = loadWorkstream(repoRoot, workstreamId)
  const coverage = turn
    ? coverageForTurn({
        turn,
        paths,
        workstream,
        graph: ledger.graph,
      })
    : checkPathCoverage({
        paths,
        featureIds: workstream.featureIds,
        expectedPaths: (workstream.suggestedSlices ?? []).flatMap(
          (s) => s.expectedPaths ?? [],
        ),
        graph: ledger.graph,
      })

  if (coverage.uncoveredPaths.length === 0) {
    return {
      ok: true,
      treeDigest,
      turnId: turn?.id,
      workstreamId,
      coverage,
      satisfiedBy: "coverage",
      message: `align OK — ${coverage.coveredPaths.length} product path(s) covered (${coverage.coverageSource})`,
    }
  }

  const policy = alignPolicy(workstream)
  const productCount = coverage.productPaths.filter((p) => !isExemptPath(p)).length
  if (turn && policy.requireAlignApprove) {
    const reviews = listReviewsForTurn(repoRoot, turn.id)
    const waivers = listAlignWaiversForTurn(repoRoot, turn.id)
    // Only current digest + close-time digest — never digests harvested from
    // the reviews/waivers under evaluation (tautology).
    const digests = new Set<string>([treeDigest])
    if (turn.status === "closed" && turn.facts?.verify?.treeDigest) {
      digests.add(turn.facts.verify.treeDigest)
    }
    for (const d of digests) {
      const satisfied = alignApproveSatisfied({
        reviews,
        waivers,
        treeDigest: d,
        policy,
        turnHasProductFiles: productCount > 0,
        producer: turn.opened?.producedBy,
      })
      if (satisfied) {
        const byApprove = reviews.some(
          (r) =>
            r.treeDigest === d &&
            r.coverageSource &&
            (r.uncoveredPaths?.length === 0 || Boolean(r.waiverIds?.length)),
        )
        return {
          ok: true,
          treeDigest,
          turnId: turn.id,
          workstreamId,
          coverage,
          satisfiedBy: byApprove ? "approve" : "waiver",
          message: `align OK — uncovered waived/approved for treeDigest (${coverage.uncoveredPaths.length} path(s) noted)`,
        }
      }
    }
  }

  if (!turn && policy.allowExplicitAlignSkip !== false) {
    const waivers = listAlignWaivers(repoRoot).filter(
      (w) => w.treeDigest === treeDigest,
    )
    if (waivers.length) {
      return {
        ok: true,
        treeDigest,
        workstreamId,
        coverage,
        satisfiedBy: "waiver",
        message: `align OK — repo waiver covers treeDigest (${coverage.uncoveredPaths.length} uncovered noted)`,
      }
    }
  }

  return {
    ok: false,
    treeDigest,
    turnId: turn?.id,
    workstreamId,
    coverage,
    message: `align FAIL — uncovered: ${coverage.uncoveredPaths.join(", ")}`,
  }
}

function pickActiveWorkstream(repoRoot: string): string | undefined {
  const list = listWorkstreams(repoRoot)
  const sealed = list.find((w) => w.status === "sealed" || w.status === "active")
  return sealed?.id
}
