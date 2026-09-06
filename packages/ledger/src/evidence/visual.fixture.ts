import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { initLedger } from "../cli/init.js"
import { writeJson } from "../fs/load.js"
import { sourceFingerprint } from "./fingerprint.js"
import { recordAuthority, planRevision } from "../permission/authority.js"
import { loadWorkstream } from "../workstream/load.js"
import { executeOperation, type OperationName } from "../application/operations.js"
export const fixturePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP2kAAAAASUVORK5CYII=", "base64")
export function visualFixture(surfaces = ["Desktop", "Mobile"]) {
  const workstreamId=randomUUID(),sliceId=randomUUID(),claimId=randomUUID(),bindingId=randomUUID()
  const root = mkdtempSync(join(tmpdir(), "sl-visual-"))
  const git = (...args: string[]) => { const r = spawnSync("git", args, { cwd: root, encoding: "utf8" }); if (r.status) throw new Error(r.stderr) }
  git("init", "-q"); git("config", "user.name", "Visual fixture"); git("config", "user.email", "fixture@example.test")
  initLedger(root, "Visual fixture"); writeFileSync(join(root, "app.txt"), "UI version one")
  writeJson(join(root, `.spec-ledger/claims/${claimId}.json`), { id: claimId, statement: "Fixture behavior", required: true })
  writeJson(join(root, `.spec-ledger/bindings/${bindingId}.json`), { id: bindingId, claimId: claimId, kind: "test", locator: { type: "command", command: "node -e \"console.log('fixture check passed')\"" } })
  writeJson(join(root, `.spec-ledger/workstreams/${workstreamId}.json`), { schemaVersion: 1, id: workstreamId, status: "shaped", createdAt: new Date().toISOString(), title: "Visual fixture", problem: "Need screenshots", objective: "Inspect UI", featureIds: ["verify"], trust: surfaces.length ? { visualEvidence: { [sliceId]: surfaces } } : {}, policy: { requireSpecBreak: false, requireCodeBreak: false }, suggestedSlices: [{ id: sliceId, title: "Visual change", kind: "vertical", acceptance: ["UI works"], evidence: surfaces.length ? ["screenshot"] : [] }], acceptanceClaimIds: { [`${sliceId}/AC-1`]: [claimId] } })
  git("add", "."); git("commit", "-qm", "fixture")
  const authority=recordAuthority(root, { action: "grant", mode: "request", workstreamId: workstreamId, featureIds: ["verify"], source: { kind: "agent-reported", reference: "test authorization" } })
  const guards = () => ({ expectedSourceDigest: sourceFingerprint(root)!, expectedRevisionDigest: planRevision(root, loadWorkstream(root, workstreamId)) })
  const call = (operation: OperationName, input: object) => executeOperation(root, operation, input)
  const mutation = (operation: OperationName, input: object = {}) => call(operation, Object.fromEntries(Object.entries({ requestId: randomUUID(), ...guards(), ...input }).filter(([, value]) => value !== undefined)))
  const turn=mutation("begin_work", { workstreamId: workstreamId, sliceId: sliceId, goal: "Inspect UI", expectedSourceDigest: undefined, allowDirty: true }) as {id:string}
  mkdirSync(join(root, ".spec-ledger/evidence/screenshots"), { recursive: true })
  const capture = (name: string, extra = "") => { const path = `.spec-ledger/evidence/screenshots/${name}.png`; writeFileSync(join(root, path), Buffer.concat([fixturePng, Buffer.from(extra)])); return path }
  return { workstreamId,sliceId,turnId:turn.id,authorityId:authority.id,claimId,bindingId,root, guards, call, mutation, capture, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}
