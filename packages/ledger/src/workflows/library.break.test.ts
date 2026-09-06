import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { rmSync } from "node:fs"
import { test } from "node:test"
import { initLedger } from "../cli/init.js"
import {
  adoptWorkflowProfile, defaultWorkflowProfileId, deleteWorkflowProfile, portableStages,
  projectWorkflow, preserveWorkflow, readWorkflowProfile, resolveWorkflow, saveWorkflowProfile,
  setDefaultWorkflowProfile, updateWorkflowProfile, workflowLibrary,
} from "./index.js"
import type { WorkflowProfile } from "./types.js"

/**
 * Two workstreams whose acceptance criteria differ, because criterion ids are
 * counted per workstream — that is what makes a saved profile unportable if it
 * carries them.
 */
function fixture(policy?: { requireSpecBreak?: boolean; requireCodeBreak?: boolean }): string {
  const root = mkdtempSync(join(tmpdir(), "sl-library-"))
  initLedger(root, "library fixture")
  const write = (id: string, criteria: string[]) =>
    writeFileSync(join(root, `.spec-ledger/workstreams/${id}.json`), JSON.stringify({
      schemaVersion: 1, id, status: "shaped", createdAt: "2026-01-01T00:00:00.000Z",
      title: id, problem: "p", objective: "o", featureIds: ["workflow"],
      acceptanceCriteria: criteria,
      acceptanceClaimIds: Object.fromEntries(criteria.map((_, i) => [`AC-${i + 1}`, ["02f2ae36-9568-53f9-bc0c-a25f0a7e3af4"]])),
      policy: { requireSpecBreak: true, requireCodeBreak: true, ...policy },
      suggestedSlices: [{ id: "886b091f-57f9-5f69-9e74-f0b50275d693", title: "Build", kind: "vertical", acceptance: ["Works"] }],
    }))
  write("2b74bc14-227a-5c05-b2ed-1c32d9703cad", ["One"])
  write("d30877ac-696d-5e71-b593-783728a4c76d", ["One", "Two", "Three"])
  return root
}

/** The workflow 2b74bc14-227a-5c05-b2ed-1c32d9703cad already runs, made portable. */
function savedFromDefault(root: string, id = "6a83b98b-f128-515c-ad3f-7763860992bb"): WorkflowProfile {
  const resolved = resolveWorkflow(root, "2b74bc14-227a-5c05-b2ed-1c32d9703cad")
  return { id, title: "Team workflow", stages: portableStages(resolved.stages) }
}

test("a saved workflow applies to a spec whose requirements are numbered differently", () => {
  const root = fixture()
  try {
    const record = saveWorkflowProfile(root, savedFromDefault(root))
    // Saving must not smuggle 2b74bc14-227a-5c05-b2ed-1c32d9703cad's single criterion into the record.
    for (const stage of record.stages) {
      for (const step of stage.steps) {
        assert.ok(step.outputs.every(o => o.criterionIds === undefined), `${stage.id}/${step.id} kept criterion ids`)
      }
    }

    const snapshot = adoptWorkflowProfile(root, "d30877ac-696d-5e71-b593-783728a4c76d", "6a83b98b-f128-515c-ad3f-7763860992bb")
    assert.equal(snapshot.profile.source, "library")
    assert.equal(snapshot.profile.id, "6a83b98b-f128-515c-ad3f-7763860992bb")
    assert.equal(snapshot.profile.profileDigest, record.digest, "records the version it copied")

    const verify = snapshot.stages.find(s => s.role === "verify")!
    assert.deepEqual(
      verify.steps[0]!.outputs[0]!.criterionIds,
      ["AC-1", "AC-2", "AC-3"],
      "coverage comes from the adopting spec, not the one it was saved from",
    )
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("saving is create-only and refuses a workflow carrying another spec's requirement numbers", () => {
  const root = fixture()
  try {
    saveWorkflowProfile(root, savedFromDefault(root))
    assert.throws(() => saveWorkflowProfile(root, savedFromDefault(root)), /already exists/)

    const scoped = savedFromDefault(root, "c84fd53a-a10b-51f7-bcbf-c20bf84110dd")
    scoped.stages![3]!.steps[0]!.outputs[0]!.criterionIds = ["AC-1"]
    assert.throws(() => saveWorkflowProfile(root, scoped), /criterion ids/)
    assert.equal(workflowLibrary(root).length, 1, "a refused save stores nothing")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("adoption is refused when the workflow lacks a review stage the spec requires", () => {
  const root = fixture()
  try {
    const profile = savedFromDefault(root, "cec5c3ec-ca9d-5dd7-93aa-61be3f2aa4bb")
    profile.stages = profile.stages!.filter(stage => stage.role !== "code-review")
    saveWorkflowProfile(root, profile)

    assert.throws(() => adoptWorkflowProfile(root, "d30877ac-696d-5e71-b593-783728a4c76d", "cec5c3ec-ca9d-5dd7-93aa-61be3f2aa4bb"), /code-review/)
    assert.equal(projectWorkflow(root, "d30877ac-696d-5e71-b593-783728a4c76d").profile.source, "default", "nothing was stored")

    const [entry] = workflowLibrary(root, "d30877ac-696d-5e71-b593-783728a4c76d")
    assert.match(String(entry!.unusableReason), /code-review/, "the list says why before you pick it")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("editing or deleting a saved workflow leaves an adopted spec running unchanged", () => {
  const root = fixture()
  try {
    const record = saveWorkflowProfile(root, savedFromDefault(root))
    const adopted = adoptWorkflowProfile(root, "d30877ac-696d-5e71-b593-783728a4c76d", "6a83b98b-f128-515c-ad3f-7763860992bb")
    const before = projectWorkflow(root, "d30877ac-696d-5e71-b593-783728a4c76d")

    const edited = { ...savedFromDefault(root), title: "Renamed" }
    edited.stages = edited.stages!.filter(stage => stage.role !== "code-review")
    updateWorkflowProfile(root, edited, record.digest)

    const afterEdit = projectWorkflow(root, "d30877ac-696d-5e71-b593-783728a4c76d")
    assert.equal(afterEdit.profile.snapshotDigest, adopted.snapshotDigest)
    assert.deepEqual(afterEdit.stages.map(s => [s.id, s.status]), before.stages.map(s => [s.id, s.status]))

    deleteWorkflowProfile(root, "6a83b98b-f128-515c-ad3f-7763860992bb", readWorkflowProfile(root, "6a83b98b-f128-515c-ad3f-7763860992bb").digest)
    const afterDelete = projectWorkflow(root, "d30877ac-696d-5e71-b593-783728a4c76d")
    assert.deepEqual(afterDelete.stages.map(s => [s.id, s.status]), before.stages.map(s => [s.id, s.status]))
    assert.equal(afterDelete.profile.id, "6a83b98b-f128-515c-ad3f-7763860992bb", "the spec still names the workflow it copied")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("editing and deleting require the version the caller read", () => {
  const root = fixture()
  try {
    const record = saveWorkflowProfile(root, savedFromDefault(root))
    updateWorkflowProfile(root, { ...savedFromDefault(root), title: "First" }, record.digest)

    assert.throws(() => updateWorkflowProfile(root, { ...savedFromDefault(root), title: "Second" }, record.digest), /has changed/)
    assert.throws(() => deleteWorkflowProfile(root, "6a83b98b-f128-515c-ad3f-7763860992bb", record.digest), /has changed/)
    assert.equal(readWorkflowProfile(root, "6a83b98b-f128-515c-ad3f-7763860992bb").title, "First", "a refused write changes nothing")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("the normal workflow falls back to the bundled one when it is deleted", () => {
  const root = fixture()
  try {
    const record = saveWorkflowProfile(root, savedFromDefault(root))
    setDefaultWorkflowProfile(root, "6a83b98b-f128-515c-ad3f-7763860992bb")
    assert.equal(defaultWorkflowProfileId(root), "6a83b98b-f128-515c-ad3f-7763860992bb")
    assert.equal(workflowLibrary(root)[0]!.isDefault, true)

    deleteWorkflowProfile(root, "6a83b98b-f128-515c-ad3f-7763860992bb", record.digest)
    assert.equal(defaultWorkflowProfileId(root), null, "a dangling pointer reads as no default")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("a corrupt saved workflow is refused rather than silently adopted", () => {
  const root = fixture()
  try {
    saveWorkflowProfile(root, savedFromDefault(root))
    const path = join(root, ".spec-ledger/workflows/library/6a83b98b-f128-515c-ad3f-7763860992bb.json")
    const tampered = JSON.parse(readFileSync(path, "utf8"))
    tampered.stages = tampered.stages.filter((s: { role: string }) => s.role !== "code-review")
    writeFileSync(path, JSON.stringify(tampered))

    assert.throws(() => readWorkflowProfile(root, "6a83b98b-f128-515c-ad3f-7763860992bb"), /corrupt/)
    assert.throws(() => adoptWorkflowProfile(root, "d30877ac-696d-5e71-b593-783728a4c76d", "6a83b98b-f128-515c-ad3f-7763860992bb"), /corrupt/)
    assert.throws(() => readWorkflowProfile(root, "9a47ec29-c532-5f7f-b84f-23755c5d7ee4"), /not found/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("adopting a saved copy of the bundled workflow gates exactly like the bundled workflow", () => {
  // The old rule inferred applicability from where a workflow came from, which
  // made a name-for-name copy of the bundled workflow behave differently.
  const root = fixture({ requireCodeBreak: false })
  try {
    const bundled = projectWorkflow(root, "d30877ac-696d-5e71-b593-783728a4c76d").stages.map(s => [s.id, s.status])
    saveWorkflowProfile(root, savedFromDefault(root))
    adoptWorkflowProfile(root, "d30877ac-696d-5e71-b593-783728a4c76d", "6a83b98b-f128-515c-ad3f-7763860992bb")
    assert.deepEqual(projectWorkflow(root, "d30877ac-696d-5e71-b593-783728a4c76d").stages.map(s => [s.id, s.status]), bundled)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("a review stage somebody deliberately added still counts when policy is lax", () => {
  const root = fixture({ requireCodeBreak: false })
  try {
    const profile = savedFromDefault(root, "eb08ec88-b4e1-5313-b286-459bb4f6412d")
    profile.stages = profile.stages!.map(stage => stage.role === "code-review" ? { ...stage, required: true } : stage)
    saveWorkflowProfile(root, profile)
    adoptWorkflowProfile(root, "d30877ac-696d-5e71-b593-783728a4c76d", "eb08ec88-b4e1-5313-b286-459bb4f6412d")
    const review = projectWorkflow(root, "d30877ac-696d-5e71-b593-783728a4c76d").stages.find(s => s.role === "code-review")!
    assert.notEqual(review.status, "not-applicable")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("switching an adopted workflow needs a reason and the snapshot the caller saw", () => {
  const root = fixture()
  try {
    saveWorkflowProfile(root, savedFromDefault(root))
    saveWorkflowProfile(root, { ...savedFromDefault(root, "99cf79f2-69d3-5f2f-89d3-f93dea7f2274"), title: "Other" })
    const first = adoptWorkflowProfile(root, "d30877ac-696d-5e71-b593-783728a4c76d", "6a83b98b-f128-515c-ad3f-7763860992bb")

    assert.throws(() => adoptWorkflowProfile(root, "d30877ac-696d-5e71-b593-783728a4c76d", "99cf79f2-69d3-5f2f-89d3-f93dea7f2274"), /snapshot has changed/)
    assert.throws(() => adoptWorkflowProfile(root, "d30877ac-696d-5e71-b593-783728a4c76d", "99cf79f2-69d3-5f2f-89d3-f93dea7f2274", undefined, first.snapshotDigest), /requires a reason/)

    const second = adoptWorkflowProfile(root, "d30877ac-696d-5e71-b593-783728a4c76d", "99cf79f2-69d3-5f2f-89d3-f93dea7f2274", "Trying the other one", first.snapshotDigest)
    assert.equal(second.profile.id, "99cf79f2-69d3-5f2f-89d3-f93dea7f2274")
    assert.equal(second.supersedesSnapshotDigest, first.snapshotDigest)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("a saved workflow whose skill file is gone is refused with its path, and listed as unusable", () => {
  const root = fixture()
  try {
    writeFileSync(join(root, "skill.md"), "# Local\n")
    const profile = savedFromDefault(root, "48dd8972-6390-59cd-95f1-bc4c2617ecf1")
    profile.stages = profile.stages!.map(stage => stage.role === "implement"
      ? { ...stage, steps: stage.steps.map(step => ({ ...step, skill: { path: "skill.md", acknowledgeUncertain: true } })) }
      : stage)
    saveWorkflowProfile(root, profile)
    assert.equal(workflowLibrary(root, "d30877ac-696d-5e71-b593-783728a4c76d")[0]!.unusableReason, null)

    rmSync(join(root, "skill.md"))
    assert.throws(() => adoptWorkflowProfile(root, "d30877ac-696d-5e71-b593-783728a4c76d", "48dd8972-6390-59cd-95f1-bc4c2617ecf1"), /skill\.md/)
    assert.match(String(workflowLibrary(root, "d30877ac-696d-5e71-b593-783728a4c76d")[0]!.unusableReason), /skill\.md/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("a hand-written workflow is untouched by library coverage binding", () => {
  const root = fixture()
  try {
    const inline = savedFromDefault(root, "51141be8-b362-5e37-9386-fb197351b71d")
    inline.stages![3]!.steps[0]!.outputs[0]!.criterionIds = ["AC-2"]
    const snapshot = preserveWorkflow(root, "d30877ac-696d-5e71-b593-783728a4c76d", inline, undefined)
    assert.equal(snapshot.profile.source, "custom")
    assert.deepEqual(snapshot.stages.find(s => s.role === "verify")!.steps[0]!.outputs[0]!.criterionIds, ["AC-2"])
  } finally { rmSync(root, { recursive: true, force: true }) }
})
