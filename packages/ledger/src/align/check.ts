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

/**
 * Align check: product paths (turn files or dirty tree) vs sealed plan coverage.
 * OK when uncovered empty OR approve/waiver covers treeDigest (when required).
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
  if (turn?.status === "closed" && turn.facts?.files?.length) {
    paths = turn.facts.files.map((f) => f.path)
  } else if (turn) {
    paths = changedPathsSince(ledger.repoRoot, turn.opened?.baseCommit)
    if (!paths.length) paths = dirtyPaths(ledger.repoRoot)
  } else {
    paths = dirtyPaths(ledger.repoRoot)
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
    const dirtyProduct = dirtyPaths(repoRoot).filter((p) => !isExemptPath(p))
    const digests = new Set<string>([treeDigest])
    // After commit, HEAD moves — approve stamped pre-commit still counts
    // when there is no fresh dirty product surface.
    if (turn.status === "closed" && dirtyProduct.length === 0) {
      if (turn.facts?.verify?.treeDigest) digests.add(turn.facts.verify.treeDigest)
      for (const r of reviews) {
        if (r.treeDigest) digests.add(r.treeDigest)
      }
      for (const w of waivers) digests.add(w.treeDigest)
    }
    for (const d of digests) {
      const satisfied = alignApproveSatisfied({
        reviews,
        waivers,
        treeDigest: d,
        policy,
        turnHasProductFiles: productCount > 0,
      })
      if (satisfied) {
        const byApprove = reviews.some(
          (r) =>
            r.treeDigest === d &&
            (Boolean(r.waiverIds?.length) || r.uncoveredPaths?.length === 0),
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
