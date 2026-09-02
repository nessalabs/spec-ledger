import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { blastRadius } from "../graph/impact.js"
import { loadLedger, writeJson } from "../fs/load.js"
import { verifyLedger } from "../verify/verify.js"
import type {
  LoadedLedger,
  Turn,
  TurnFileChange,
  TurnFileKind,
  TurnFacts,
} from "../types.js"

const PRODUCED_BY = "@nessa/spec-ledger@0.1.0"

function git(repoRoot: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" })
  return { ok: r.status === 0, out: (r.stdout || "").trim() }
}

function gitCommit(repoRoot: string): string | null {
  const r = git(repoRoot, ["rev-parse", "HEAD"])
  return r.ok && r.out ? r.out : null
}

function mapStatus(code: string): TurnFileKind {
  if (code.startsWith("A") || code === "??") return "added"
  if (code.startsWith("D")) return "deleted"
  if (code.startsWith("R")) return "renamed"
  return "modified"
}

/** Changed paths from git. Prefers HEAD diff; falls back to porcelain status. */
export function collectGitFiles(repoRoot: string): TurnFileChange[] {
  const hasHead = git(repoRoot, ["rev-parse", "--verify", "HEAD"]).ok
  const byPath = new Map<string, TurnFileChange>()

  if (hasHead) {
    const names = git(repoRoot, ["diff", "--name-status", "HEAD"])
    if (names.ok) {
      for (const line of names.out.split("\n").filter(Boolean)) {
        const [code, ...rest] = line.split("\t")
        const path = rest[rest.length - 1]
        if (!code || !path) continue
        byPath.set(path, { path, kind: mapStatus(code), additions: 0, deletions: 0 })
      }
    }
    const nums = git(repoRoot, ["diff", "--numstat", "HEAD"])
    if (nums.ok) {
      for (const line of nums.out.split("\n").filter(Boolean)) {
        const [a, d, ...pathParts] = line.split("\t")
        const path = pathParts.join("\t")
        if (!path) continue
        const cur = byPath.get(path) ?? {
          path,
          kind: "modified" as const,
          additions: 0,
          deletions: 0,
        }
        cur.additions = a === "-" ? 0 : Number(a) || 0
        cur.deletions = d === "-" ? 0 : Number(d) || 0
        byPath.set(path, cur)
      }
    }
  }

  const status = git(repoRoot, ["status", "--porcelain", "-uall"])
  if (status.ok) {
    for (const line of status.out.split("\n").filter(Boolean)) {
      const code = line.slice(0, 2).trim() || "??"
      const path = line.slice(3).trim().replace(/^"+|"+$/g, "")
      if (!path) continue
      if (!byPath.has(path)) {
        byPath.set(path, { path, kind: mapStatus(code), additions: 0, deletions: 0 })
      }
    }
  }

  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))
}

function pathTouchesLocator(filePath: string, locator: string | undefined): boolean {
  if (!locator) return false
  const loc = locator.replace(/^\.\//, "").replace(/\/$/, "")
  return filePath === loc || filePath.startsWith(`${loc}/`)
}

export function deriveTouched(ledger: LoadedLedger, files: TurnFileChange[]) {
  const paths = files.map((f) => f.path)
  const touchedNodeIds = new Set<string>()
  const touchedFeatureIds = new Set<string>()
  const touchedClaimIds = new Set<string>()

  if (ledger.graph) {
    for (const node of ledger.graph.nodes) {
      if (paths.some((p) => pathTouchesLocator(p, node.locator))) {
        touchedNodeIds.add(node.id)
        for (const f of node.featureIds ?? []) touchedFeatureIds.add(f)
        for (const c of node.claimIds ?? []) touchedClaimIds.add(c)
      }
    }
    for (const feature of ledger.graph.features) {
      for (const entry of feature.entryPoints ?? []) {
        if (paths.some((p) => pathTouchesLocator(p, entry))) {
          touchedFeatureIds.add(feature.id)
          for (const c of feature.claimIds ?? []) touchedClaimIds.add(c)
        }
      }
    }
  }

  for (const b of ledger.bindings) {
    if (b.locator.type === "path" && b.locator.path) {
      if (paths.some((p) => pathTouchesLocator(p, b.locator.path))) {
        touchedClaimIds.add(b.claimId)
      }
    }
  }

  // Claim / binding file edits touch those claim ids by filename convention.
  for (const p of paths) {
    const claimMatch = p.match(/\.spec-ledger\/claims\/([^/]+)\.json$/)
    if (claimMatch) touchedClaimIds.add(claimMatch[1]!)
    const bindMatch = p.match(/\.spec-ledger\/bindings\/([^/]+)\.json$/)
    if (bindMatch) {
      const binding = ledger.bindings.find((b) => b.id === bindMatch[1] || p.endsWith(`${b.id}.json`))
      if (binding) touchedClaimIds.add(binding.claimId)
    }
  }

  const direct = new Set<string>()
  const transitive = new Set<string>()
  if (ledger.graph) {
    for (const id of touchedNodeIds) {
      const r = blastRadius(ledger.graph, id)
      for (const d of r.direct) direct.add(d)
      for (const t of r.transitive) transitive.add(t)
    }
  }

  const schemaSurfaceChanged = paths.some(
    (p) =>
      p.startsWith("schemas/") ||
      p.startsWith(".spec-ledger/claims/") ||
      p.startsWith(".spec-ledger/bindings/"),
  )

  return {
    touchedNodeIds: [...touchedNodeIds].sort(),
    touchedFeatureIds: [...touchedFeatureIds].sort(),
    touchedClaimIds: [...touchedClaimIds].sort(),
    blastRadius: {
      direct: [...direct].sort(),
      transitive: [...transitive].sort(),
    },
    schemaSurfaceChanged,
  }
}

export function computeTurnFacts(ledger: LoadedLedger): TurnFacts {
  const files = collectGitFiles(ledger.repoRoot)
  const derived = deriveTouched(ledger, files)
  const report = verifyLedger(ledger)
  return {
    producedBy: PRODUCED_BY,
    commit: gitCommit(ledger.repoRoot),
    files,
    touchedNodeIds: derived.touchedNodeIds,
    touchedFeatureIds: derived.touchedFeatureIds,
    touchedClaimIds: derived.touchedClaimIds,
    blastRadius: derived.blastRadius,
    verify: {
      ok: report.ok,
      ledgerDigest: report.provenance.ledgerDigest,
      resultsDigest: report.provenance.resultsDigest,
      producedAt: report.producedAt,
    },
    schemaSurfaceChanged: derived.schemaSurfaceChanged,
  }
}

export function turnsDir(ledger: LoadedLedger): string {
  return join(ledger.rootDir, ledger.config.turnsDir ?? "turns")
}

export function listTurns(ledger: LoadedLedger): Turn[] {
  const dir = turnsDir(ledger)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Turn)
    .sort((a, b) => a.id.localeCompare(b.id))
}

function readTurnFile(ledger: LoadedLedger, id: string): { path: string; turn: Turn } {
  const path = join(turnsDir(ledger), `${id}.json`)
  if (!existsSync(path)) throw new Error(`turn not found: ${id}`)
  const turn = JSON.parse(readFileSync(path, "utf8")) as Turn
  return { path, turn }
}

export function openTurn(
  repoRootInput: string,
  intent: Turn["intent"],
  idHint?: string,
): Turn {
  const ledger = loadLedger(repoRootInput)
  const dir = turnsDir(ledger)
  const existing = listTurns(ledger)
  const open = existing.filter((t) => t.status === "open")
  if (open.length) {
    throw new Error(`open turn already exists: ${open.map((t) => t.id).join(", ")}`)
  }
  const nextNum =
    existing.reduce((max, t) => {
      const n = Number(t.id.replace(/^T-/, "").split(".")[0])
      return Number.isFinite(n) ? Math.max(max, n) : max
    }, 0) + 1
  const id = idHint ?? `T-${String(nextNum).padStart(3, "0")}`
  if (existing.some((t) => t.id === id)) throw new Error(`turn id already exists: ${id}`)

  const turn: Turn = {
    schemaVersion: 1,
    id,
    status: "open",
    openedAt: new Date().toISOString(),
    intent,
  }
  writeJson(join(dir, `${id}.json`), turn)
  return turn
}

export function closeTurn(repoRootInput: string, id?: string): Turn {
  const ledger = loadLedger(repoRootInput)
  const turns = listTurns(ledger)
  const target =
    id != null
      ? turns.find((t) => t.id === id)
      : turns.find((t) => t.status === "open") ?? turns.at(-1)
  if (!target) throw new Error("no turn to close")
  if (target.status === "closed" && target.facts) {
    throw new Error(`turn ${target.id} is already closed`)
  }

  const facts = computeTurnFacts(ledger)
  const closed: Turn = {
    ...target,
    status: "closed",
    closedAt: new Date().toISOString(),
    facts,
  }
  const { path } = readTurnFile(ledger, target.id)
  writeJson(path, closed)
  return closed
}
