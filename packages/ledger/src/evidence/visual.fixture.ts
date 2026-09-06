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
  const root = mkdtempSync(join(tmpdir(), "sl-visual-"))
  const git = (...args: string[]) => { const r = spawnSync("git", args, { cwd: root, encoding: "utf8" }); if (r.status) throw new Error(r.stderr) }
  git("init", "-q"); git("config", "user.name", "Visual fixture"); git("config", "user.email", "fixture@example.test")
  initLedger(root, "Visual fixture"); writeFileSync(join(root, "app.txt"), "UI version one")
  writeJson(join(root, ".spec-ledger/claims/SL-001.json"), { id: "SL-001", statement: "Fixture behavior", required: true })
  writeJson(join(root, ".spec-ledger/bindings/b.json"), { id: "b", claimId: "SL-001", kind: "test", locator: { type: "command", command: "node -e \"console.log('fixture check passed')\"" } })
  writeJson(join(root, ".spec-ledger/workstreams/W-001.json"), { schemaVersion: 1, id: "W-001", status: "shaped", createdAt: new Date().toISOString(), title: "Visual fixture", problem: "Need screenshots", objective: "Inspect UI", featureIds: ["verify"], trust: surfaces.length ? { visualEvidence: { "SLC-01": surfaces } } : {}, policy: { requireSpecBreak: false, requireCodeBreak: false }, suggestedSlices: [{ id: "SLC-01", title: "Visual change", kind: "vertical", acceptance: ["UI works"], evidence: surfaces.length ? ["screenshot"] : [] }], acceptanceClaimIds: { "SLC-01/AC-1": ["SL-001"] } })
  git("add", "."); git("commit", "-qm", "fixture")
  recordAuthority(root, { id: "AUTH-fixture", action: "grant", mode: "request", workstreamId: "W-001", featureIds: ["verify"], source: { kind: "agent-reported", reference: "test authorization" } })
  const guards = () => ({ expectedSourceDigest: sourceFingerprint(root)!, expectedRevisionDigest: planRevision(root, loadWorkstream(root, "W-001")) })
  const call = (operation: OperationName, input: object) => executeOperation(root, operation, input)
  const mutation = (operation: OperationName, input: object = {}) => call(operation, Object.fromEntries(Object.entries({ requestId: randomUUID(), ...guards(), ...input }).filter(([, value]) => value !== undefined)))
  mutation("begin_work", { workstreamId: "W-001", sliceId: "SLC-01", turnId: "T-001", goal: "Inspect UI", expectedSourceDigest: undefined, allowDirty: true })
  mkdirSync(join(root, ".spec-ledger/evidence/screenshots"), { recursive: true })
  const capture = (name: string, extra = "") => { const path = `.spec-ledger/evidence/screenshots/${name}.png`; writeFileSync(join(root, path), Buffer.concat([fixturePng, Buffer.from(extra)])); return path }
  return { root, guards, call, mutation, capture, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}
