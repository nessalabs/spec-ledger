import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { loadLedger, sha256Stable, writeJson } from "../fs/load.js"
import type { ResultsFile, ResultsRow } from "../types.js"
import { checkFingerprint, sourceFingerprint, localArtifactPath, contentHash } from "./fingerprint.js"

export interface EvidenceInput {
  bindingId: string
  outcome: ResultsRow["outcome"]
  sourceDigest: string
  checkDigest: string
  producer: { name: string; version: string }
  artifactPaths?: string[]
  runId?: string
  detail?: string
}

/** External runners supply fingerprints captured before execution. This records their provenance, not authenticated proof. */
export function recordEvidence(root: string, input: EvidenceInput): ResultsFile {
  const ledger = loadLedger(root)
  const binding = ledger.bindings.find(b => b.id === input.bindingId)
  const claim = binding && ledger.claims.find(c => c.id === binding.claimId)
  if (!binding || !claim || binding.locator.type !== "results-row") throw new Error("evidence recording requires an existing results-row binding")
  if (!["pass","fail","missing","attested"].includes(input.outcome)) throw new Error("invalid evidence outcome")
  if (!input.producer?.name || !input.producer.version) throw new Error("evidence producer required")
  if (input.sourceDigest !== sourceFingerprint(ledger.repoRoot,ledger.config.generatedArtifactPaths) || input.checkDigest !== checkFingerprint(claim,binding)) throw new Error("evidence inputs do not match current source and check")
  const runId = input.runId ?? randomUUID()
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(runId)) throw new Error("invalid evidence run id")
  const artifacts = (input.artifactPaths ?? []).map(path => ({path, sha256:contentHash(readFileSync(localArtifactPath(ledger.repoRoot,path))),required:true}))
  const row: ResultsRow = {key:binding.locator.resultsKey ?? claim.id,outcome:input.outcome,sourceDigest:input.sourceDigest,checkDigest:input.checkDigest,runId,artifacts,...(input.detail ? {detail:input.detail} : {})}
  const runPath = join(ledger.rootDir,"evidence/runs",`${runId}.json`)
  let run: ResultsFile = {schemaVersion:1,producedAt:new Date().toISOString(),producer:input.producer,rows:[row]}
  mkdirSync(dirname(runPath),{recursive:true})
  try {
    writeFileSync(runPath,`${JSON.stringify(run,null,2)}\n`,{flag:"wx"})
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    const previous = JSON.parse(readFileSync(runPath,"utf8")) as ResultsFile
    if (sha256Stable({producer:previous.producer,rows:previous.rows}) !== sha256Stable({producer:run.producer,rows:run.rows})) throw new Error("run id already belongs to different evidence")
    run=previous
  }
  // Run receipt is written first; retry can finish updating the current projection.
  writeJson(join(ledger.rootDir,ledger.config.resultsPath ?? "results/last.json"), {...run,rows:[...(ledger.results?.rows ?? []).filter(r=>r.key !== row.key),row]})
  return run
}
