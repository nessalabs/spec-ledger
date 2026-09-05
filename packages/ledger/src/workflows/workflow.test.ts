import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { initLedger } from "../cli/init.js"
import { resolveWorkflow } from "./index.js"
import type { WorkflowProfile } from "./types.js"

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "sl-workflow-"))
  initLedger(root, "workflow fixture")
  writeFileSync(join(root, ".spec-ledger/workstreams/W-001.json"), JSON.stringify({
    schemaVersion: 1, id: "W-001", status: "shaped", createdAt: "2026-01-01T00:00:00.000Z",
    title: "Workflow", problem: "Need a method", objective: "Use a chosen method", featureIds: ["workflow"],
    acceptanceCriteria: ["Works"], acceptanceClaimIds: { "AC-1": ["SL-001"] }, policy: { requireSpecBreak: true, requireCodeBreak: true },
    suggestedSlices: [{ id: "SLC-01", title: "Build", kind: "vertical", acceptance: ["Works"] }],
  }))
  return root
}

test("default workflow needs no configuration and preserves substantive bundled guidance", () => {
  const root = fixture()
  try {
    const resolved = resolveWorkflow(root, "W-001")
    assert.equal(resolved.profile.source, "default")
    assert.deepEqual(resolved.stages.map(stage => stage.role), ["plan", "spec-review", "implement", "verify", "code-review"])
    assert.ok(resolved.stages.every(stage => stage.steps[0]!.skill.content.length > 200))
    assert.ok(resolved.stages.every(stage => stage.steps[0]!.outputs.length > 0))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("custom workflow preserves exact local skill text and rejects unsafe or incompatible skills", () => {
  const root = fixture(); const outside = mkdtempSync(join(tmpdir(), "sl-workflow-outside-"))
  try {
    mkdirSync(join(root, "skills/custom"), { recursive: true })
    const content = "# Custom method\n\nInspect the bounded plan and preserve the revision.\n"
    writeFileSync(join(root, "skills/custom/SKILL.md"), content)
    const profile: WorkflowProfile = { id: "team", title: "Team method", extends: "spec-ledger/default", skills: {
      plan: { path: "skills/custom/SKILL.md", capabilities: ["spec-revision"] },
    } }
    const resolved = resolveWorkflow(root, "W-001", profile)
    const skill = resolved.stages[0]!.steps[0]!.skill
    assert.equal(skill.content, content)
    assert.equal(skill.digest, createHash("sha256").update(content).digest("hex"))

    assert.throws(() => resolveWorkflow(root, "W-001", { ...profile, skills: { plan: { path: "skills/missing.md", capabilities: ["spec-revision"] } } }), /missing/)
    writeFileSync(join(outside, "SKILL.md"), "outside")
    symlinkSync(join(outside, "SKILL.md"), join(root, "skills/custom/escape.md"))
    assert.throws(() => resolveWorkflow(root, "W-001", { ...profile, skills: { plan: { path: "skills/custom/escape.md", capabilities: ["spec-revision"] } } }), /symlink/)
    writeFileSync(join(root, "skills/custom/large.md"), "x".repeat(64 * 1024 + 1))
    assert.throws(() => resolveWorkflow(root, "W-001", { ...profile, skills: { plan: { path: "skills/custom/large.md", capabilities: ["spec-revision"] } } }), /exceeds/)
    assert.throws(() => resolveWorkflow(root, "W-001", { ...profile, skills: { plan: { path: "skills/custom/SKILL.md" } } }), /acknowledge uncertainty/)
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }) }
})
