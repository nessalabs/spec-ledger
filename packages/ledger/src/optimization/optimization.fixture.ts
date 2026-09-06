import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { initLedger } from "../cli/init.js"
import { writeJson } from "../fs/load.js"
import { sourceFingerprint } from "../evidence/fingerprint.js"
import { recordAuthority, planRevision } from "../permission/authority.js"
import { loadWorkstream } from "../workstream/load.js"
import { executeOperation, type OperationName } from "../application/operations.js"

/** Synthetic isolated ledger for tests and explicitly labeled visual demonstrations. */
export function optimizationFixture() {
  const workstreamId=randomUUID(),sliceId=randomUUID(),claimId=randomUUID(),bindingId=randomUUID()
  const root = mkdtempSync(join(tmpdir(), "sl-experiments-"))
  function git(...args: string[]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
    if (result.status !== 0) throw new Error(result.stderr)
  }
  git("init", "-q"); git("config", "user.name", "Experiment fixture"); git("config", "user.email", "fixture@example.test")
  initLedger(root, "Experiment demonstration")
  writeFileSync(join(root, "system.ts"), "export const version = 1\n")
  writeJson(join(root, `.spec-ledger/workstreams/${workstreamId}.json`), {
    schemaVersion: 1, id: workstreamId, status: "shaped", createdAt: "2026-09-06T00:00:00.000Z",
    title: "Improve a system through experiments", problem: "Synthetic demonstration", objective: "Learn from bounded attempts", featureIds: ["verify"],
    policy: { requireSpecBreak: false, requireCodeBreak: false },
    suggestedSlices: [{ id: sliceId, kind: "vertical", title: "Improve a system", acceptance: ["Record findings"] }],
  })
  git("add", "."); git("commit", "-qm", "Synthetic experiment fixture")
  const authority=recordAuthority(root, { action: "grant", mode: "request", workstreamId: workstreamId, featureIds: ["verify"], source: { kind: "agent-reported", reference: "Synthetic fixture authorization" } })
  const guards = () => ({ expectedRevisionDigest: planRevision(root, loadWorkstream(root, workstreamId)), expectedSourceDigest: sourceFingerprint(root)! })
  const call = (operation: OperationName, input: object = {}) => {
    const current = guards()
    const guard = operation === "begin_work" ? {expectedRevisionDigest: current.expectedRevisionDigest} : operation === "finish_turn" ? {expectedSourceDigest: current.expectedSourceDigest} : current
    return executeOperation(root, operation, Object.fromEntries(Object.entries({ requestId: randomUUID(), ...guard, ...input }).filter(([,v]) => v !== undefined)))
  }
  const turn=call("begin_work", { workstreamId: workstreamId, sliceId: sliceId, goal: "Learn from experiments", expectedSourceDigest: undefined, allowDirty: true }) as {id:string}
  return { workstreamId,sliceId,turnId:turn.id,authorityId:authority.id,claimId,bindingId,root, guards, call, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}
