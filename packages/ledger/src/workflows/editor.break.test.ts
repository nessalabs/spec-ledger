import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  mkdtempSync,
  mkdirSync,
  existsSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { initLedger } from "../cli/init.js"
import { sourceFingerprint } from "../evidence/fingerprint.js"
import { writeJson } from "../fs/load.js"
import { planRevision, recordAuthority } from "../permission/authority.js"
import { loadWorkstream } from "../workstream/load.js"
import { executeOperation } from "../application/operations.js"
import { createLocalWorkflowBridge } from "./local-ui.js"
import { workflowOptions } from "./options.js"
import type { WorkflowProfile, WorkflowSnapshot } from "./types.js"

function git(root: string, ...args: string[]): void {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
}

function fixture(policy: { requireSpecBreak?: boolean; requireCodeBreak?: boolean } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "sl-workflow-break-"))
  git(root, "init", "-q")
  git(root, "config", "user.email", "fixture@example.test")
  git(root, "config", "user.name", "Fixture")
  initLedger(root, "workflow breaker")
  mkdirSync(join(root, "skills"), { recursive: true })
  writeFileSync(join(root, "skills/team.md"), "# Team method\nPreserve the contract and cite current evidence.\n")
  writeFileSync(join(root, "source.ts"), "export const behavior = true\n")
  writeJson(join(root, ".spec-ledger/workstreams/W-001.json"), {
    schemaVersion: 1,
    id: "W-001",
    status: "shaped",
    createdAt: "2026-09-05T00:00:00.000Z",
    title: "Workflow boundary",
    problem: "Custom methods must preserve evidence gates",
    objective: "Keep custom method evidence current and scoped",
    featureIds: ["alpha"],
    acceptanceCriteria: ["The behavior is verified"],
    acceptanceClaimIds: { "AC-1": ["SL-001"] },
    policy: { requireSpecBreak: policy.requireSpecBreak ?? false, requireCodeBreak: policy.requireCodeBreak ?? false },
    suggestedSlices: [{ id: "SLC-01", title: "Method", kind: "vertical", acceptance: ["Works"] }],
  })
  git(root, "add", ".")
  git(root, "commit", "-qm", "fixture")
  recordAuthority(root, {
    id: "AUTH-workflow-breaker",
    action: "grant",
    mode: "request",
    workstreamId: "W-001",
    featureIds: ["alpha"],
    source: { kind: "agent-reported", reference: "fixture authorization" },
  })
  return root
}

function source(root: string): string {
  const digest = sourceFingerprint(root)
  assert.ok(digest)
  return digest
}

function revision(root: string): string {
  return planRevision(root, loadWorkstream(root, "W-001"))
}

let requestSequence = 0
function requestId(label: string): string {
  requestSequence += 1
  return `${label}-${String(requestSequence).padStart(6, "0")}`
}

function entryCount(path: string): number {
  return existsSync(path) ? readdirSync(path).length : 0
}

const allCapabilities = ["spec-revision", "spec-review", "implementation-report", "check-results", "code-review", "attestation"] as const

function profile(stages: WorkflowProfile["stages"]): WorkflowProfile {
  return {
    id: "breaker-method",
    title: "Breaker method",
    skills: { team: { path: "skills/team.md", capabilities: [...allCapabilities] } },
    stages,
  }
}

function select(root: string, method: WorkflowProfile, extra: Record<string, unknown> = {}): WorkflowSnapshot {
  return executeOperation(root, "set_workflow", {
    requestId: requestId("select-workflow"),
    workstreamId: "W-001",
    expectedRevisionDigest: revision(root),
    expectedSourceDigest: source(root),
    profile: method,
    ...extra,
  }) as WorkflowSnapshot
}

function minimalStages(firstOutputs: Array<{ kind: "attestation" | "code-review" }>): NonNullable<WorkflowProfile["stages"]> {
  return [
    { id: "build", title: "Build", role: "implement", steps: [{ id: "work", title: "Work", skill: "team", outputs: [{ kind: "implementation-report" }, ...firstOutputs] }] },
    { id: "verify", title: "Verify", role: "verify", steps: [{ id: "confirm", title: "Confirm", skill: "team", outputs: [{ kind: "check-results" }] }] },
  ]
}


describe("workflow editor boundary regressions", () => {
  it("roundtrips bundled choices and hides symlinked discovery roots", () => {
    const root = fixture(), outside = mkdtempSync(join(tmpdir(), "sl-editor-outside-"))
    try {
      mkdirSync(join(outside, "skills/team"), { recursive: true })
      writeFileSync(join(outside, "skills/team/SKILL.md"), "outside private guidance")
      symlinkSync(outside, join(root, ".agents"), "dir")
      mkdirSync(join(root, "skills/local"))
      writeFileSync(join(root, "skills/local/SKILL.md"), "local guidance")
      const options = workflowOptions(root, "W-001")
      assert.deepEqual(options.localSkills, ["skills/local/SKILL.md"])
      const preview = executeOperation(root, "preview_workflow", { workstreamId: "W-001", profile: options.defaultProfile }) as WorkflowSnapshot
      assert.ok(preview.stages.every(stage => stage.steps.every(step => step.skill.source === "bundled")))
      assert.equal(entryCount(join(root, ".spec-ledger/workflows")), 0)
    } finally { rmSync(root,{recursive:true,force:true}); rmSync(outside,{recursive:true,force:true}) }
  })

  it("rejects attestation substitutes for every mandatory stage output", () => {
    const root = fixture({requireSpecBreak:true,requireCodeBreak:true})
    try {
      const valid = workflowOptions(root,"W-001").defaultProfile
      for (const role of ["spec-review","implement","verify","code-review"]) {
        const invalid = structuredClone(valid)
        const stage = invalid.stages!.find(s=>s.role===role)!
        // A local skill declaring every capability isolates the role/output gate.
        stage.steps = [{id:"substitute",title:"Substitute",skill:{path:"skills/team.md",capabilities:[...allCapabilities]},outputs:[{kind:"attestation"}]}]
        assert.throws(()=>executeOperation(root,"preview_workflow",{workstreamId:"W-001",profile:invalid}), /requires .* output/)
      }
      assert.equal(entryCount(join(root,".spec-ledger/workflows")),0)
    } finally { rmSync(root,{recursive:true,force:true}) }
  })

  it("rejects changed skill content and stale amendment identity without replacing the selection", () => {
    const root=fixture()
    try {
      const method=profile(minimalStages([]))
      const preview=executeOperation(root,"preview_workflow",{workstreamId:"W-001",profile:method}) as WorkflowSnapshot
      writeFileSync(join(root,"skills/team.md"),"Changed since the user previewed it")
      assert.throws(()=>select(root,method,{expectedConfigurationDigest:preview.snapshotDigest}),/guidance changed/)
      assert.equal(entryCount(join(root,".spec-ledger/workflows")),0)
      const first=select(root,method)
      const second=select(root,method,{expectedSnapshotDigest:first.snapshotDigest,reason:"Update chosen guidance"})
      assert.throws(()=>select(root,method,{expectedSnapshotDigest:first.snapshotDigest,reason:"Stale second browser"}),/snapshot has changed/)
      assert.throws(()=>select(root,method,{expectedSnapshotDigest:second.snapshotDigest}),/requires a reason/)
      assert.equal(entryCount(join(root,".spec-ledger/workflows/snapshots/W-001")),2)
      assert.equal((executeOperation(root,"get_workflow",{workstreamId:"W-001"}) as {profile:{snapshotDigest:string}}).profile.snapshotDigest,second.snapshotDigest)
    } finally { rmSync(root,{recursive:true,force:true}) }
  })

  it("rejects oversized and malformed browser actions without writes or execution", async () => {
    const root=fixture()
    try {
      const bridge=createLocalWorkflowBridge(root), url="http://localhost:3737/api/workflow?workstreamId=W-001"
      const {token}=await (await bridge(new Request(url))).json()
      const headers={origin:"http://localhost:3737","content-type":"application/json","x-spec-ledger-token":token}
      assert.equal((await bridge(new Request(url,{method:"POST",headers,body:"x".repeat(131073)}))).status,413)
      for(const body of ["null","[]","1","{",JSON.stringify({action:"begin_workflow_step",input:{workstreamId:"W-001"}})]) {
        const response=await bridge(new Request(url,{method:"POST",headers,body}))
        assert.ok(response.status>=400)
      }
      assert.equal((await bridge(new Request("http://attacker.example:3737/api/workflow?workstreamId=W-001",{headers:{host:"localhost:3737"}}))).status,403)
      assert.equal(entryCount(join(root,".spec-ledger/workflows")),0)
    } finally { rmSync(root,{recursive:true,force:true}) }
  })

  it("browser preview and apply share core state, deny foreign requests, and retry once", async () => {
    const root = fixture()
    try {
      const bridge = createLocalWorkflowBridge(root)
      const url = "http://127.0.0.1:3737/api/workflow?workstreamId=W-001"
      const get = await bridge(new Request(url)); assert.equal(get.status,200)
      const {token,options} = await get.json() as {token:string;options:ReturnType<typeof workflowOptions>}
      assert.equal(entryCount(join(root,".spec-ledger/workflows")),0)
      const send = (action:string,input:unknown,headers:Record<string,string>={})=>bridge(new Request(url,{method:"POST",headers:{origin:"http://127.0.0.1:3737","content-type":"application/json","x-spec-ledger-token":token,...headers},body:JSON.stringify({action,input})}))
      const previewResponse = await send("preview",{workstreamId:"W-001",profile:options.profile});assert.equal(previewResponse.status,200)
      const {preview} = await previewResponse.json() as {preview:WorkflowSnapshot}
      const input = {requestId:requestId("bridge-save"),workstreamId:"W-001",profile:options.profile,expectedRevisionDigest:options.expectedRevisionDigest,expectedSourceDigest:options.expectedSourceDigest,expectedConfigurationDigest:preview.snapshotDigest}
      for (const headers of [{origin:"https://unrelated.example"},{"x-spec-ledger-token":"wrong"}] as Record<string,string>[]) {
        assert.equal((await send("apply",input,headers)).status,403)
        assert.equal(entryCount(join(root,".spec-ledger/workflows")),0)
      }
      const foreignRead = await bridge(new Request(url,{headers:{origin:"https://unrelated.example"}}));assert.equal(foreignRead.status,403)
      assert.equal((await send("apply",{...input,requestId:requestId("wrong-digest"),expectedConfigurationDigest:"0".repeat(64)})).status,409)
      assert.equal(entryCount(join(root,".spec-ledger/workflows")),0)
      const saved = await send("apply",input);assert.equal(saved.status,200)
      const first = await saved.json()
      assert.deepEqual(await (await send("apply",input)).json(),first)
      assert.equal(entryCount(join(root,".spec-ledger/workflows/snapshots/W-001")),1)
      const observed = executeOperation(root,"get_workflow",{workstreamId:"W-001"}) as {profile:{snapshotDigest:string}}
      assert.equal(observed.profile.snapshotDigest,first.snapshotDigest)
      const changed = {...input,requestId:requestId("stale-preview"),profile:{...options.profile,title:"Changed"}}
      assert.equal((await send("apply",changed)).status,409)
      assert.equal(entryCount(join(root,".spec-ledger/workflows/snapshots/W-001")),1)
    } finally { rmSync(root,{recursive:true,force:true}) }
  })
})
