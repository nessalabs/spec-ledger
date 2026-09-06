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
      acceptanceClaimIds: Object.fromEntries(criteria.map((_, i) => [`AC-${i + 1}`, ["SL-001"]])),
      policy: { requireSpecBreak: true, requireCodeBreak: true, ...policy },
      suggestedSlices: [{ id: "SLC-01", title: "Build", kind: "vertical", acceptance: ["Works"] }],
    }))
  write("W-001", ["One"])
  write("W-002", ["One", "Two", "Three"])
  return root
}

/** The workflow W-001 already runs, made portable. */
function savedFromDefault(root: string, id = "team"): WorkflowProfile {
  const resolved = resolveWorkflow(root, "W-001")
  return { id, title: "Team workflow", stages: portableStages(resolved.stages) }
}

test("a saved workflow applies to a spec whose requirements are numbered differently", () => {
  const root = fixture()
  try {
    const record = saveWorkflowProfile(root, savedFromDefault(root))
    // Saving must not smuggle W-001's single criterion into the record.
    for (const stage of record.stages) {
      for (const step of stage.steps) {
        assert.ok(step.outputs.every(o => o.criterionIds === undefined), `${stage.id}/${step.id} kept criterion ids`)
      }
    }

    const snapshot = adoptWorkflowProfile(root, "W-002", "team")
    assert.equal(snapshot.profile.source, "library")
    assert.equal(snapshot.profile.id, "team")
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

    const scoped = savedFromDefault(root, "scoped")
    scoped.stages![3]!.steps[0]!.outputs[0]!.criterionIds = ["AC-1"]
    assert.throws(() => saveWorkflowProfile(root, scoped), /criterion ids/)
    assert.equal(workflowLibrary(root).length, 1, "a refused save stores nothing")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("adoption is refused when the workflow lacks a review stage the spec requires", () => {
  const root = fixture()
  try {
    const profile = savedFromDefault(root, "no-review")
    profile.stages = profile.stages!.filter(stage => stage.role !== "code-review")
    saveWorkflowProfile(root, profile)

    assert.throws(() => adoptWorkflowProfile(root, "W-002", "no-review"), /code-review/)
    assert.equal(projectWorkflow(root, "W-002").profile.source, "default", "nothing was stored")

    const [entry] = workflowLibrary(root, "W-002")
    assert.match(String(entry!.unusableReason), /code-review/, "the list says why before you pick it")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("editing or deleting a saved workflow leaves an adopted spec running unchanged", () => {
  const root = fixture()
  try {
    const record = saveWorkflowProfile(root, savedFromDefault(root))
    const adopted = adoptWorkflowProfile(root, "W-002", "team")
    const before = projectWorkflow(root, "W-002")

    const edited = { ...savedFromDefault(root), title: "Renamed" }
    edited.stages = edited.stages!.filter(stage => stage.role !== "code-review")
    updateWorkflowProfile(root, edited, record.digest)

    const afterEdit = projectWorkflow(root, "W-002")
    assert.equal(afterEdit.profile.snapshotDigest, adopted.snapshotDigest)
    assert.deepEqual(afterEdit.stages.map(s => [s.id, s.status]), before.stages.map(s => [s.id, s.status]))

    deleteWorkflowProfile(root, "team", readWorkflowProfile(root, "team").digest)
    const afterDelete = projectWorkflow(root, "W-002")
    assert.deepEqual(afterDelete.stages.map(s => [s.id, s.status]), before.stages.map(s => [s.id, s.status]))
    assert.equal(afterDelete.profile.id, "team", "the spec still names the workflow it copied")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("editing and deleting require the version the caller read", () => {
  const root = fixture()
  try {
    const record = saveWorkflowProfile(root, savedFromDefault(root))
    updateWorkflowProfile(root, { ...savedFromDefault(root), title: "First" }, record.digest)

    assert.throws(() => updateWorkflowProfile(root, { ...savedFromDefault(root), title: "Second" }, record.digest), /has changed/)
    assert.throws(() => deleteWorkflowProfile(root, "team", record.digest), /has changed/)
    assert.equal(readWorkflowProfile(root, "team").title, "First", "a refused write changes nothing")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("the normal workflow falls back to the bundled one when it is deleted", () => {
  const root = fixture()
  try {
    const record = saveWorkflowProfile(root, savedFromDefault(root))
    setDefaultWorkflowProfile(root, "team")
    assert.equal(defaultWorkflowProfileId(root), "team")
    assert.equal(workflowLibrary(root)[0]!.isDefault, true)

    deleteWorkflowProfile(root, "team", record.digest)
    assert.equal(defaultWorkflowProfileId(root), null, "a dangling pointer reads as no default")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("a corrupt saved workflow is refused rather than silently adopted", () => {
  const root = fixture()
  try {
    saveWorkflowProfile(root, savedFromDefault(root))
    const path = join(root, ".spec-ledger/workflows/library/team.json")
    const tampered = JSON.parse(readFileSync(path, "utf8"))
    tampered.stages = tampered.stages.filter((s: { role: string }) => s.role !== "code-review")
    writeFileSync(path, JSON.stringify(tampered))

    assert.throws(() => readWorkflowProfile(root, "team"), /corrupt/)
    assert.throws(() => adoptWorkflowProfile(root, "W-002", "team"), /corrupt/)
    assert.throws(() => readWorkflowProfile(root, "missing"), /not found/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("adopting a saved copy of the bundled workflow gates exactly like the bundled workflow", () => {
  // The old rule inferred applicability from where a workflow came from, which
  // made a name-for-name copy of the bundled workflow behave differently.
  const root = fixture({ requireCodeBreak: false })
  try {
    const bundled = projectWorkflow(root, "W-002").stages.map(s => [s.id, s.status])
    saveWorkflowProfile(root, savedFromDefault(root))
    adoptWorkflowProfile(root, "W-002", "team")
    assert.deepEqual(projectWorkflow(root, "W-002").stages.map(s => [s.id, s.status]), bundled)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("a review stage somebody deliberately added still counts when policy is lax", () => {
  const root = fixture({ requireCodeBreak: false })
  try {
    const profile = savedFromDefault(root, "strict")
    profile.stages = profile.stages!.map(stage => stage.role === "code-review" ? { ...stage, required: true } : stage)
    saveWorkflowProfile(root, profile)
    adoptWorkflowProfile(root, "W-002", "strict")
    const review = projectWorkflow(root, "W-002").stages.find(s => s.role === "code-review")!
    assert.notEqual(review.status, "not-applicable")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("switching an adopted workflow needs a reason and the snapshot the caller saw", () => {
  const root = fixture()
  try {
    saveWorkflowProfile(root, savedFromDefault(root))
    saveWorkflowProfile(root, { ...savedFromDefault(root, "other"), title: "Other" })
    const first = adoptWorkflowProfile(root, "W-002", "team")

    assert.throws(() => adoptWorkflowProfile(root, "W-002", "other"), /snapshot has changed/)
    assert.throws(() => adoptWorkflowProfile(root, "W-002", "other", undefined, first.snapshotDigest), /requires a reason/)

    const second = adoptWorkflowProfile(root, "W-002", "other", "Trying the other one", first.snapshotDigest)
    assert.equal(second.profile.id, "other")
    assert.equal(second.supersedesSnapshotDigest, first.snapshotDigest)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("a saved workflow whose skill file is gone is refused with its path, and listed as unusable", () => {
  const root = fixture()
  try {
    writeFileSync(join(root, "skill.md"), "# Local\n")
    const profile = savedFromDefault(root, "local")
    profile.stages = profile.stages!.map(stage => stage.role === "implement"
      ? { ...stage, steps: stage.steps.map(step => ({ ...step, skill: { path: "skill.md", acknowledgeUncertain: true } })) }
      : stage)
    saveWorkflowProfile(root, profile)
    assert.equal(workflowLibrary(root, "W-002")[0]!.unusableReason, null)

    rmSync(join(root, "skill.md"))
    assert.throws(() => adoptWorkflowProfile(root, "W-002", "local"), /skill\.md/)
    assert.match(String(workflowLibrary(root, "W-002")[0]!.unusableReason), /skill\.md/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("a hand-written workflow is untouched by library coverage binding", () => {
  const root = fixture()
  try {
    const inline = savedFromDefault(root, "inline")
    inline.stages![3]!.steps[0]!.outputs[0]!.criterionIds = ["AC-2"]
    const snapshot = preserveWorkflow(root, "W-002", inline, undefined)
    assert.equal(snapshot.profile.source, "custom")
    assert.deepEqual(snapshot.stages.find(s => s.role === "verify")!.steps[0]!.outputs[0]!.criterionIds, ["AC-2"])
  } finally { rmSync(root, { recursive: true, force: true }) }
})
