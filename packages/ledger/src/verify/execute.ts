import { randomUUID } from "node:crypto"
import { sourceFingerprint, checkFingerprint } from "../evidence/fingerprint.js"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { loadLedger, writeJson } from "../fs/load.js"
import type { ResultsRow, VerifyReport } from "../types.js"
import { verifyLedger } from "./verify.js"

/** Explicit write-side operation. Never call from HTTP or a status projection. */
export function checkLedger(repoRoot: string): VerifyReport {
  const ledger = loadLedger(repoRoot)
  const before = sourceFingerprint(ledger.repoRoot, ledger.config.generatedArtifactPaths)
  const runId = randomUUID()
  const commands = ledger.bindings.filter((b) => b.locator.type === "command" && b.locator.command)
  const commandKeys = new Set(commands.map((b) => `command:${b.id}`))
  const rows: ResultsRow[] = (ledger.results?.rows ?? []).filter((r) => !commandKeys.has(r.key))
  for (const binding of commands) {
    const run = spawnSync(binding.locator.command!, { cwd: ledger.repoRoot, shell: true,
      encoding: "utf8", timeout: 120_000, maxBuffer: 1024 * 1024, env: process.env })
    const claim = ledger.claims.find(c => c.id === binding.claimId)
    rows.push({ key: `command:${binding.id}`, runId, sourceDigest: before ?? undefined,
      checkDigest: claim ? checkFingerprint(claim,binding) : undefined,
      outcome: run.status === 0 ? "pass" : "fail",
      detail: run.error ? "Command could not complete (start failure, timeout, or output limit)" : `exit ${run.status}` })
  }
  const after = sourceFingerprint(ledger.repoRoot, ledger.config.generatedArtifactPaths)
  const current = loadLedger(repoRoot)
  for (const row of rows.filter(r => r.runId === runId)) {
    const binding = current.bindings.find(b => `command:${b.id}` === row.key)
    const claim = binding && current.claims.find(c => c.id === binding.claimId)
    if (!before || before !== after || !binding || !claim || row.checkDigest !== checkFingerprint(claim,binding)) {
      row.outcome = "missing"
      row.detail = "Inputs changed or could not be observed during check execution"
    }
  }
  if (commands.length) {
    writeJson(join(ledger.rootDir,"evidence/runs",`${runId}.json`), {
      schemaVersion:1,producedAt:new Date().toISOString(),producer:{name:"spec-ledger check",version:"0.1.0"},rows:rows.filter(r=>r.runId===runId),
    })
    writeJson(join(ledger.rootDir, ledger.config.resultsPath ?? "results/last.json"), {
      schemaVersion: 1, producedAt: new Date().toISOString(),
      producer: { name: "spec-ledger check", version: "0.1.0" }, rows,
    })
  }
  const report = verifyLedger(loadLedger(repoRoot))
  writeJson(join(ledger.rootDir, ledger.config.reportPath ?? "results/report.json"), report)
  return report
}
