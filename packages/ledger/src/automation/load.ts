import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot, writeJson } from "../fs/load.js"
import type { AutomationEvent, LedgerRootConfig } from "../types.js"

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function loadConfig(rootDir: string): LedgerRootConfig {
  return readJson<LedgerRootConfig>(join(rootDir, "ledger.json"))
}

export function automationEventsDir(repoRootInput: string): string {
  const repoRoot = findRepoRoot(repoRootInput)
  const rootDir = ledgerRoot(repoRoot)
  const config = loadConfig(rootDir)
  return join(rootDir, config.automationEventsDir ?? "automation-events")
}

export function listAutomationEvents(repoRootInput: string): AutomationEvent[] {
  const dir = automationEventsDir(repoRootInput)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson<AutomationEvent>(join(dir, f)))
}

export function writeAutomationEvent(
  repoRootInput: string,
  event: AutomationEvent,
): AutomationEvent {
  const dir = automationEventsDir(repoRootInput)
  mkdirSync(dir, { recursive: true })
  writeJson(join(dir, `${event.id}.json`), event)
  return event
}

export function nextAutomationEventId(repoRootInput: string): string {
  const max = listAutomationEvents(repoRootInput).reduce((m, e) => {
    const n = Number(e.id.replace(/^AE-/, ""))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `AE-${String(max + 1).padStart(3, "0")}`
}

/**
 * Apply wait timeouts before context/open. Returns remaining open + just-resolved.
 */
export function resumeAutomationEvents(
  repoRootInput: string,
  opts?: { workstreamId?: string; turnId?: string; now?: Date },
): { open: AutomationEvent[]; recent: AutomationEvent[] } {
  const now = opts?.now ?? new Date()
  const recent: AutomationEvent[] = []
  const all = listAutomationEvents(repoRootInput)
  const scoped = all.filter((e) => {
    if (opts?.workstreamId && e.workstreamId && e.workstreamId !== opts.workstreamId) {
      return false
    }
    if (opts?.turnId && e.turnId && e.turnId !== opts.turnId) return false
    return true
  })

  for (const e of scoped) {
    if (e.state !== "waiting") continue
    if (!e.waitUntil) continue
    if (new Date(e.waitUntil).getTime() > now.getTime()) continue

    const timeout =
      (e.policySnapshot.onAlertTimeout as string | undefined) ??
      (e.policySnapshot.onSealedDeviationTimeout as string | undefined) ??
      "move"
    const resolution = timeout === "block" ? "block" : "move"
    const updated: AutomationEvent = {
      ...e,
      state: resolution === "block" ? "blocked" : "resolved",
      trigger: "timeout",
      resolution,
      resolvedAt: now.toISOString(),
      resolvedBy: "system:timeout",
      note: e.note ?? "wait timeout applied on context/open",
    }
    writeAutomationEvent(repoRootInput, updated)
    recent.push(updated)
  }

  const refreshed = listAutomationEvents(repoRootInput).filter((e) => {
    if (opts?.workstreamId && e.workstreamId && e.workstreamId !== opts.workstreamId) {
      return false
    }
    if (opts?.turnId && e.turnId && e.turnId !== opts.turnId) return false
    return e.state === "waiting" || e.state === "blocked"
  })

  return { open: refreshed, recent }
}

export function blockedAutomationEvents(
  repoRootInput: string,
  opts?: { workstreamId?: string; turnId?: string },
): AutomationEvent[] {
  return listAutomationEvents(repoRootInput).filter((e) => {
    if (e.state !== "blocked") return false
    if (opts?.workstreamId && e.workstreamId && e.workstreamId !== opts.workstreamId) {
      return false
    }
    if (opts?.turnId && e.turnId && e.turnId !== opts.turnId) return false
    return true
  })
}
