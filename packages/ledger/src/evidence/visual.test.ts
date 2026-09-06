import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { writeFileSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"
import { visualFixture } from "./visual.fixture.js"
import { checkVisualEvidence } from "./visual.js"
import { getSession } from "../session/project.js"

test("visual evidence blocks close until every current surface is attached, preserves retries, and rejects changed images", () => {
  const f = visualFixture()
  try {
    assert.equal(checkVisualEvidence(f.root, f.workstreamId).ok, false)
    assert.throws(() => f.mutation("finish_turn", { turnId: f.turnId, action: "close", expectedRevisionDigest: undefined }), /Attach screenshots of all relevant UI/)
    const first = { requestId: randomUUID(), ...f.guards(), turnId: f.turnId, surface: "Desktop", path: f.capture("desktop") }
    const record = f.call("record_screenshot", first)
    assert.deepEqual(f.call("record_screenshot", first), record)
    assert.equal(checkVisualEvidence(f.root, f.workstreamId).surfaces.filter(s => s.satisfied).length, 1)
    f.mutation("record_screenshot", { turnId: f.turnId, surface: "Mobile", path: f.capture("mobile", "second view") })
    assert.equal(checkVisualEvidence(f.root, f.workstreamId).ok, true)
    f.mutation("finish_turn", { turnId: f.turnId, action: "close", expectedRevisionDigest: undefined })
    assert.equal(checkVisualEvidence(f.root, f.workstreamId).ok, true)
    writeFileSync(join(f.root, first.path), "changed image")
    assert.equal(getSession(f.root, f.workstreamId).session!.visualEvidence.ok, false)
    assert.throws(() => f.mutation("complete_work", { workstreamId: f.workstreamId }), /Attach screenshots/)
  } finally { f.cleanup() }
})
test("source changes and duplicate screenshot reuse cannot satisfy current coverage", () => {
  const f = visualFixture()
  try {
    const path = f.capture("same")
    for (const surface of ["Desktop", "Mobile"]) f.mutation("record_screenshot", { turnId: f.turnId, surface, path })
    assert.equal(checkVisualEvidence(f.root, f.workstreamId).ok, false)
    writeFileSync(join(f.root, "app.txt"), "new source")
    assert.ok(checkVisualEvidence(f.root, f.workstreamId).surfaces.every(s => !s.satisfied))
    assert.throws(() => f.mutation("record_screenshot", { turnId: f.turnId, surface: "Unknown", path }), /declared/)
  } finally { f.cleanup() }
})
test("CLI screenshot and evidence check use the shared coverage evaluator", () => {
  const f = visualFixture(["Desktop"])
  try {
    const cli = fileURLToPath(new URL("../cli/main.js", import.meta.url))
    const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args, "--root", f.root], { encoding: "utf8" })
    assert.equal(run("evidence", "check", "--workstream", f.workstreamId).status, 1)
    const result = run("evidence", "screenshot", "--turn", f.turnId, "--surface", "Desktop", "--path", f.capture("desktop"))
    assert.equal(result.status, 0, result.stderr)
    assert.equal(run("evidence", "check", "--workstream", f.workstreamId).status, 0)
    const wsPath = join(f.root, `.spec-ledger/workstreams/${f.workstreamId}.json`), ws = JSON.parse(readFileSync(wsPath, "utf8"))
    ws.trust.visualEvidence = { [f.sliceId]: [] }; writeFileSync(wsPath, JSON.stringify(ws))
    assert.equal(run("evidence", "check", "--workstream", f.workstreamId).status, 1)
  } finally { f.cleanup() }
})
test("nonvisual work keeps its existing close path", () => {
  const f = visualFixture([])
  try {
    assert.equal(checkVisualEvidence(f.root, f.workstreamId).required, false)
    f.mutation("finish_turn", { turnId: f.turnId, action: "close", expectedRevisionDigest: undefined })
  } finally { f.cleanup() }
})
