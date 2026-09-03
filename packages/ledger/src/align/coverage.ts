import type { CodebaseGraph, Turn, Workstream } from "../types.js"
import {
  DEFAULT_ALIGN_IGNORE,
  isExemptPath,
  isUnsafeRepoPath,
  normalizeRepoPath,
  pathMatchesPattern,
} from "./paths.js"

export interface AlignCoverageInput {
  paths: string[]
  featureIds?: string[]
  expectedPaths?: string[]
  graph?: CodebaseGraph | null
  ignore?: readonly string[]
}

export interface AlignCoverageResult {
  productPaths: string[]
  coveredPaths: string[]
  uncoveredPaths: string[]
  coverageSource: "graph" | "expectedPaths" | "mixed" | "user"
  coveredBy: Record<string, string[]>
}

/** Locators owned by nodes that list any of the given featureIds. */
export function locatorsForFeatures(
  graph: CodebaseGraph | null | undefined,
  featureIds: string[] | undefined,
): string[] {
  if (!graph || !featureIds?.length) return []
  const set = new Set(featureIds)
  const out: string[] = []
  for (const n of graph.nodes) {
    const fids = n.featureIds ?? []
    if (!fids.some((id) => set.has(id))) continue
    if (n.locator) out.push(normalizeRepoPath(n.locator))
  }
  return [...new Set(out)]
}

export function checkPathCoverage(input: AlignCoverageInput): AlignCoverageResult {
  const ignore = input.ignore ?? DEFAULT_ALIGN_IGNORE
  const productPaths = [
    ...new Set(
      input.paths
        .filter((p) => p && p.trim())
        .map((p) => normalizeRepoPath(p))
        .filter((p) => p && !isExemptPath(p, ignore)),
    ),
  ].sort()

  const fromGraph = locatorsForFeatures(input.graph, input.featureIds)
  const fromExpected = (input.expectedPaths ?? []).map(normalizeRepoPath)
  const patterns = [...new Set([...fromGraph, ...fromExpected])]

  const coveredBy: Record<string, string[]> = {}
  const coveredPaths: string[] = []
  const uncoveredPaths: string[] = []

  for (const path of productPaths) {
    // Traversal / absolute never count as covered (defense in depth after normalize).
    if (isUnsafeRepoPath(path)) {
      uncoveredPaths.push(path)
      continue
    }
    const hits = patterns.filter((pat) => pathMatchesPattern(path, pat))
    if (hits.length) {
      coveredPaths.push(path)
      coveredBy[path] = hits
    } else {
      uncoveredPaths.push(path)
    }
  }

  let coverageSource: AlignCoverageResult["coverageSource"] = "user"
  if (fromGraph.length && fromExpected.length) coverageSource = "mixed"
  else if (fromGraph.length) coverageSource = "graph"
  else if (fromExpected.length) coverageSource = "expectedPaths"

  return {
    productPaths,
    coveredPaths,
    uncoveredPaths,
    coverageSource,
    coveredBy,
  }
}

export function sliceExpectedPaths(
  workstream: Workstream,
  sliceId: string | undefined,
): string[] {
  if (!sliceId) {
    return (workstream.suggestedSlices ?? []).flatMap((s) => s.expectedPaths ?? [])
  }
  const slice = workstream.suggestedSlices?.find((s) => s.id === sliceId)
  return slice?.expectedPaths ?? []
}

export function coverageForTurn(args: {
  turn: Turn
  paths: string[]
  workstream: Workstream
  graph: CodebaseGraph | null
}): AlignCoverageResult {
  const { turn, paths, workstream, graph } = args
  return checkPathCoverage({
    paths,
    featureIds: turn.intent.featureIds ?? workstream.featureIds,
    expectedPaths: sliceExpectedPaths(workstream, turn.intent.sliceId),
    graph,
  })
}
