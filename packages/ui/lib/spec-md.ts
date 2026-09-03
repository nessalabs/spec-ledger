import { readFileSync, existsSync } from "node:fs"
import { resolve, relative, isAbsolute } from "node:path"
import { ledgerRootDir } from "@/lib/ledger"

/** Resolve a repo-relative path; refuse escapes outside the ledger root. */
function resolveInRepo(specPath: string): string | null {
  if (!specPath || isAbsolute(specPath) || specPath.includes("\0")) return null
  const root = resolve(ledgerRootDir())
  const abs = resolve(root, specPath)
  const rel = relative(root, abs)
  if (rel.startsWith("..") || isAbsolute(rel)) return null
  return abs
}

/** Read any text file under the repo root (docs, DESIGN.md, …). */
export function readRepoText(specPath: string | null | undefined): string | null {
  if (!specPath) return null
  const abs = resolveInRepo(specPath)
  if (!abs || !existsSync(abs)) return null
  try {
    return readFileSync(abs, "utf8")
  } catch {
    return null
  }
}

/** Read repo-relative Markdown (workstream/vision specPath). */
export function readRepoMarkdown(specPath: string | null | undefined): string | null {
  return readRepoText(specPath)
}

/** Pull ## Problem / ## Objective sections when present. */
export function extractPlanSections(md: string): {
  problem?: string
  objective?: string
  body: string
} {
  const problem = sectionAfter(md, "Problem")
  const objective = sectionAfter(md, "Objective")
  return { problem, objective, body: md }
}

function sectionAfter(md: string, title: string): string | undefined {
  const re = new RegExp(
    `^##\\s+${title}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`,
    "im",
  )
  const m = md.match(re)
  return m?.[1]?.trim() || undefined
}
