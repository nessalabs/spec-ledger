import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot, writeJson } from "../fs/load.js"
import { assertReviewLatticeCopy } from "./lattice-copy.js"
import type { LedgerRootConfig, Review } from "../types.js"

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function loadConfig(rootDir: string): LedgerRootConfig {
  return readJson<LedgerRootConfig>(join(rootDir, "ledger.json"))
}

export function reviewsDir(repoRootInput: string): string {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const config = loadConfig(rootDir)
  return join(rootDir, config.reviewsDir ?? "reviews")
}

export function turnReviewsDir(repoRootInput: string, turnId: string): string {
  return join(reviewsDir(repoRootInput), "turns", turnId)
}

export function listReviewsForTurn(repoRootInput: string, turnId: string): Review[] {
  const dir = turnReviewsDir(repoRootInput, turnId)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson<Review>(join(dir, f)))
}

/** Next R-NN id for a turn (local filename stem). */
export function nextReviewId(repoRootInput: string, turnId: string): string {
  const existing = listReviewsForTurn(repoRootInput, turnId)
  const max = existing.reduce((m, r) => {
    const n = Number(r.id.split("/").at(-1)?.replace(/^R-/, ""))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `${turnId}/R-${String(max + 1).padStart(2, "0")}`
}

function walkReviewJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walkReviewJsonFiles(p))
    else if (name.endsWith(".json")) out.push(p)
  }
  return out
}

/** All turn + workstream reviews under reviewsDir. */
export function listAllReviews(repoRootInput: string): Review[] {
  return walkReviewJsonFiles(reviewsDir(repoRootInput)).map((p) => readJson<Review>(p))
}

export function writeReview(repoRootInput: string, review: Review): Review {
  if (!review.turnId) throw new Error("review.turnId required for turn reviews")
  assertReviewLatticeCopy(review)
  const dir = turnReviewsDir(repoRootInput, review.turnId)
  mkdirSync(dir, { recursive: true })
  const fileStem = review.id.includes("/") ? review.id.split("/").at(-1)! : review.id
  writeJson(join(dir, `${fileStem}.json`), review)
  return review
}

export function isCodeBreakApprove(review: Review): boolean {
  if (review.target === "spec") return false
  if (review.kind === "discussion") return false
  if (review.verdict !== "approve") return false
  return Array.isArray(review.killersCited) && review.killersCited.length > 0
}

export function codeBreakSatisfied(reviews: Review[]): boolean {
  return reviews.some(isCodeBreakApprove)
}

export function unresolvedBlockingReviews(reviews: Review[]): Review[] {
  const blocking = reviews.filter((r) => r.blocking === true)
  return blocking.filter((b) => {
    const resolved = reviews.some(
      (r) =>
        r.id !== b.id &&
        (r.resolvesReviewId === b.id ||
          (r.resolvesFindingIds?.length &&
            b.findings?.every((f) =>
              r.resolvesFindingIds!.includes(`${b.id}#${f.id}`),
            ))),
    )
    return !resolved
  })
}
