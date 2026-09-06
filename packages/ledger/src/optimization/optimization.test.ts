import assert from "node:assert/strict"
import { test } from "node:test"
import { existsSync, readFileSync, writeFileSync, symlinkSync, mkdtempSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { optimizationFixture } from "./optimization.fixture.js"
import { getOptimizationGoal, listOptimizationGoals } from "./index.js"
import { executeOperation } from "../application/operations.js"
import { loadLedger } from "../fs/load.js"
import { verifyLedger } from "../verify/verify.js"
import { recordAuthority } from "../permission/authority.js"

const goalInput = { title: "Reduce latency", objective: "Faster evaluation with unchanged outputs", stopWhen: "Under 100 ms or three attempts", maxExperiments: 3,
  metric: { name: "Latency", unit: "ms", direction: "minimize", protocol: "Same 100 cases on one worker", baseline: 200, target: 100 } }
function testInputs(f: ReturnType<typeof optimizationFixture>) {
  const goal = { ...goalInput, workstreamId: f.workstreamId, turnId: f.turnId }
  const attempt = (goalId: string, extra = {}) => ({ goalId, turnId: f.turnId, hypothesis: "Cache repeated work", change: "Add local memoization", ...extra })
  const result = (goalId: string, experimentId: string, extra = {}) => ({ goalId, experimentId, turnId: f.turnId, status: "completed", decision: "kept", measurement: 120, findings: "Lower latency with identical outputs", ...extra })
  return { goal, attempt, result }
}

test("iterative work is optional, records attempts faithfully, and does not change verify", () => {
  const f = optimizationFixture()
  const { goal, attempt, result } = testInputs(f)
  try {
    assert.deepEqual(listOptimizationGoals(f.root), [])
    assert.equal(existsSync(join(f.root, ".spec-ledger/optimization")), false)
    const before = verifyLedger(loadLedger(f.root))
    const created = f.call("create_goal", { goal }) as {id:string}
    const x1 = f.call("start_experiment", { experiment: attempt(created.id) }) as {id:string}
    assert.equal(getOptimizationGoal(f.root, created.id).experiments[0].result, null)
    f.call("record_experiment_result", { result: result(created.id, x1.id) })
    const x2 = f.call("start_experiment", { experiment: attempt(created.id, { parentExperimentId: x1.id }) }) as {id:string}
    f.call("record_experiment_result", { result: result(created.id, x2.id, { measurement: 80, decision: "discarded", findings: "Fast but loses a required output" }) })
    const x3 = f.call("start_experiment", { experiment: attempt(created.id) }) as {id:string}
    f.call("record_experiment_result", { result: result(created.id, x3.id, { status: "failed", decision: "inconclusive", measurement: undefined, findings: "Worker crashed" }) })
    const p = getOptimizationGoal(f.root, created.id)
    assert.equal(p.bestObserved?.value, 80); assert.equal(p.bestKept?.value, 120); assert.equal(p.latest?.value, 80)
    assert.equal(p.targetObserved, true); assert.equal(p.status, "budget-reached"); assert.equal(p.remainingExperiments, 0)
    assert.equal(p.experiments[2].result?.measurement, undefined)
    assert.throws(() => f.call("start_experiment", { experiment: attempt(created.id) }), /budget/)
    f.call("conclude_goal", { conclusion: { goalId: created.id, turnId: f.turnId, reason: "budget", summary: "Kept memoization; faster unsafe candidate discarded" } })
    assert.equal(getOptimizationGoal(f.root, created.id).status, "concluded")
    assert.equal(loadLedger(f.root).turns[0].status, "open")
    const after = verifyLedger(loadLedger(f.root))
    assert.equal(after.ok, before.ok); assert.equal(after.provenance.ledgerDigest, before.provenance.ledgerDigest)
  } finally { f.cleanup() }
})

test("immutable identity and operation retries preserve exactly one record", () => {
  const f = optimizationFixture()
  const { goal, attempt, result } = testInputs(f)
  try {
    const input = { requestId: randomUUID(), ...f.guards(), goal }
    const first = executeOperation(f.root, "create_goal", input)
    assert.deepEqual(executeOperation(f.root, "create_goal", input), first)
    const created = first as {id:string}
    assert.notEqual((f.call("create_goal", { goal }) as {id:string}).id, created.id)
    assert.throws(() => executeOperation(f.root, "create_goal", { ...input, goal: { ...goal, title: "Different" } }), /different|request/)
    const x1 = f.call("start_experiment", { experiment: attempt(created.id) }) as {id:string}
    const original = f.call("record_experiment_result", { result: result(created.id, x1.id) })
    assert.deepEqual(f.call("record_experiment_result", { result: result(created.id, x1.id) }), original)
    assert.throws(() => f.call("record_experiment_result", { result: result(created.id, x1.id, { measurement: 1 }) }), /different content/)
    assert.equal(getOptimizationGoal(f.root, created.id).experiments.length, 1)
  } finally { f.cleanup() }
})

test("rejects poison and invalid transitions without partial optimization history", () => {
  const f = optimizationFixture()
  const { goal, attempt, result } = testInputs(f)
  try {
    for (const invalid of [{ ...goal, id: "../../bad" }, { ...goal, metric: { ...goal.metric, baseline: Infinity } }, { ...goal, maxExperiments: -1 }]) {
      assert.throws(() => f.call("create_goal", { goal: invalid }), /invalid operation input/)
    }
    assert.equal(existsSync(join(f.root, ".spec-ledger/optimization")), false)
    const created = f.call("create_goal", { goal }) as {id:string}
    assert.throws(() => f.call("record_experiment_result", { result: result(created.id, randomUUID()) }), /not found/)
    assert.throws(() => f.call("start_experiment", { experiment: attempt(created.id, { parentExperimentId: randomUUID() }) }), /parent/)
    const x1 = f.call("start_experiment", { experiment: attempt(created.id) }) as {id:string}
    assert.throws(() => f.call("conclude_goal", { conclusion: { goalId: created.id, turnId: f.turnId, reason: "stopped", summary: "Stop" } }), /pending/)
    for (const extra of [{ status: "failed" }, { measurement: NaN }, { status: "failed", measurement: undefined, decision: "kept" }]) {
      assert.throws(() => f.call("record_experiment_result", { result: result(created.id, x1.id, extra) }), /invalid operation input/)
    }
    assert.equal(getOptimizationGoal(f.root, created.id).experiments[0].result, null)
    f.call("record_experiment_result", { result: result(created.id, x1.id) })
    f.call("conclude_goal", { conclusion: { goalId: created.id, turnId: f.turnId, reason: "stopped", summary: "Stop" } })
    assert.throws(() => f.call("start_experiment", { experiment: attempt(created.id) }), /concluded/)
  } finally { f.cleanup() }
})

test("goals continue on later authorized turns; closed, stale and revoked tasks cannot add history", () => {
  const f = optimizationFixture()
  const { goal, attempt, result } = testInputs(f)
  try {
    const created = f.call("create_goal", { goal }) as {id:string}
    f.call("finish_turn", { turnId: f.turnId, action: "abandon" })
    assert.throws(() => f.call("start_experiment", { experiment: attempt(created.id) }), /open turn/)
    const next = f.call("begin_work", { workstreamId: f.workstreamId, sliceId: f.sliceId, goal: "Continue experiments", expectedSourceDigest: undefined, allowDirty: true }) as {id:string}
    const nextAttempt = f.call("start_experiment", { experiment: attempt(created.id, { turnId: next.id }) }) as {id:string}
    assert.equal(listOptimizationGoals(f.root, { turnId: next.id }).length, 1)
    assert.equal(listOptimizationGoals(f.root, { turnId: randomUUID() }).length, 0)
    assert.throws(() => f.call("record_experiment_result", { result: result(created.id, nextAttempt.id, { turnId: next.id }), expectedRevisionDigest: "0".repeat(64) }), /current executable plan/)
    recordAuthority(f.root, { action: "revoke", targetId: f.authorityId, source: { kind: "agent-reported", reference: "Fixture revocation" } })
    assert.throws(() => f.call("record_experiment_result", { result: result(created.id, nextAttempt.id, { turnId: next.id }) }), /not authorized/)
  } finally { f.cleanup() }
})

test("qualitative goals and maximizing metrics do not manufacture a score", () => {
  const f = optimizationFixture()
  const { goal, attempt, result } = testInputs(f)
  try {
    const created = f.call("create_goal", { goal: { ...goal, metric: undefined } }) as {id:string}
    const x1 = f.call("start_experiment", { experiment: attempt(created.id) }) as {id:string}
    assert.throws(() => f.call("record_experiment_result", { result: result(created.id, x1.id) }), /qualitative/)
    f.call("record_experiment_result", { result: result(created.id, x1.id, { measurement: undefined }) })
    assert.equal(getOptimizationGoal(f.root, created.id).bestObserved, null)
    assert.equal(getOptimizationGoal(f.root, created.id).targetObserved, null)
    const quality = f.call("create_goal", { goal: { ...goal, metric: { ...goal.metric, direction: "maximize", baseline: 0, target: 0.9 } } }) as {id:string}
    const qualityAttempt = f.call("start_experiment", { experiment: attempt(quality.id) }) as {id:string}
    f.call("record_experiment_result", { result: result(quality.id, qualityAttempt.id, { measurement: 0.95 }) })
    assert.equal(getOptimizationGoal(f.root, quality.id).bestKept?.value, 0.95)
    assert.equal(getOptimizationGoal(f.root, quality.id).targetObserved, true)
  } finally { f.cleanup() }
})

test("optimization storage refuses symlink reads and writes", () => {
  const f = optimizationFixture(), outside = mkdtempSync(join(tmpdir(), "sl-outside-"))
  const { goal } = testInputs(f)
  try {
    symlinkSync(outside, join(f.root, ".spec-ledger/optimization"))
    assert.throws(() => listOptimizationGoals(f.root), /unsafe optimization storage/)
    assert.throws(() => f.call("create_goal", { goal }), /unsafe optimization storage/)
    assert.equal(readFileSync(join(f.root, "system.ts"), "utf8"), "export const version = 1\n")
  } finally { f.cleanup(); rmSync(outside, { recursive: true, force: true }) }
})

test("CLI convenience commands persist and inspect real experiment history", () => {
  const f = optimizationFixture(), inputs = mkdtempSync(join(tmpdir(), "sl-input-"))
  const cli = new URL("../cli/main.js", import.meta.url).pathname
  const run = (args: string[], input?: object) => {
    const file = join(inputs, "input.json")
    if (input) writeFileSync(file, JSON.stringify(input))
    const p = spawnSync(process.execPath, [cli, ...args, ...(input ? ["--file", file] : []), "--root", f.root], { encoding: "utf8" })
    assert.equal(p.status, 0, p.stderr + p.stdout)
    return JSON.parse(p.stdout)
  }
  const { goal, attempt, result } = testInputs(f)
  try {
    const created = run(["goal", "create"], goal)
    const experiment = run(["experiment", "start"], attempt(created.id))
    run(["experiment", "result"], result(created.id, experiment.id))
    assert.equal(run(["goal", "show", "--id", created.id]).bestObserved.value, 120)
    assert.equal(run(["goal", "list", "--turn", f.turnId]).length, 1)
    assert.equal(JSON.parse(readFileSync(join(f.root, `.spec-ledger/optimization/${created.id}/results/${experiment.id}.json`), "utf8")).measurement, 120)
  } finally { f.cleanup(); rmSync(inputs, { recursive: true, force: true }) }
})


test("an interrupted unpublished goal and redirected receipt cannot expose partial history", () => {
  const f = optimizationFixture()
  const { goal, attempt } = testInputs(f)
  try {
    const dir = join(f.root, `.spec-ledger/optimization/${randomUUID()}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "goal.json.interrupted.tmp"), '{"partial":')
    assert.deepEqual(listOptimizationGoals(f.root), [])
    const created = f.call("create_goal", { goal }) as {id:string}
    assert.equal(listOptimizationGoals(f.root).length, 1)
    const requestId = randomUUID()
    const sentinel = join(f.root, "receipt-sentinel.json")
    writeFileSync(sentinel, '{}')
    symlinkSync(sentinel, join(f.root, ".spec-ledger/operations", `${requestId}.started.json`))
    assert.throws(() => executeOperation(f.root, "start_experiment", { requestId, ...f.guards(), experiment: attempt(created.id) }), /unsafe optimization storage/)
    assert.equal(readFileSync(sentinel, "utf8"), '{}')
    assert.equal(getOptimizationGoal(f.root, created.id).experiments.length, 0)
  } finally { f.cleanup() }
})
