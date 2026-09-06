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

const goal = { id: "G-latency", workstreamId: "W-001", turnId: "T-001", title: "Reduce latency", objective: "Faster evaluation with unchanged outputs", stopWhen: "Under 100 ms or three attempts", maxExperiments: 3,
  metric: { name: "Latency", unit: "ms", direction: "minimize", protocol: "Same 100 cases on one worker", baseline: 200, target: 100 } }
const attempt = (id: string, extra = {}) => ({ id, goalId: goal.id, turnId: "T-001", hypothesis: "Cache repeated work", change: "Add local memoization", ...extra })
const result = (id: string, extra = {}) => ({ goalId: goal.id, experimentId: id, turnId: "T-001", status: "completed", decision: "kept", measurement: 120, findings: "Lower latency with identical outputs", ...extra })

test("iterative work is optional, records attempts faithfully, and does not change verify", () => {
  const f = optimizationFixture()
  try {
    assert.deepEqual(listOptimizationGoals(f.root), [])
    assert.equal(existsSync(join(f.root, ".spec-ledger/optimization")), false)
    const before = verifyLedger(loadLedger(f.root))
    f.call("create_goal", { goal })
    f.call("start_experiment", { experiment: attempt("X-1") })
    assert.equal(getOptimizationGoal(f.root, goal.id).experiments[0].result, null)
    f.call("record_experiment_result", { result: result("X-1") })
    f.call("start_experiment", { experiment: attempt("X-2", { parentExperimentId: "X-1" }) })
    f.call("record_experiment_result", { result: result("X-2", { measurement: 80, decision: "discarded", findings: "Fast but loses a required output" }) })
    f.call("start_experiment", { experiment: attempt("X-3") })
    f.call("record_experiment_result", { result: result("X-3", { status: "failed", decision: "inconclusive", measurement: undefined, findings: "Worker crashed" }) })
    const p = getOptimizationGoal(f.root, goal.id)
    assert.equal(p.bestObserved?.value, 80); assert.equal(p.bestKept?.value, 120); assert.equal(p.latest?.value, 80)
    assert.equal(p.targetObserved, true); assert.equal(p.status, "budget-reached"); assert.equal(p.remainingExperiments, 0)
    assert.equal(p.experiments[2].result?.measurement, undefined)
    assert.throws(() => f.call("start_experiment", { experiment: attempt("X-4") }), /budget/)
    f.call("conclude_goal", { conclusion: { goalId: goal.id, turnId: "T-001", reason: "budget", summary: "Kept memoization; faster unsafe candidate discarded" } })
    assert.equal(getOptimizationGoal(f.root, goal.id).status, "concluded")
    assert.equal(loadLedger(f.root).turns[0].status, "open")
    const after = verifyLedger(loadLedger(f.root))
    assert.equal(after.ok, before.ok); assert.equal(after.provenance.ledgerDigest, before.provenance.ledgerDigest)
  } finally { f.cleanup() }
})

test("immutable identity and operation retries preserve exactly one record", () => {
  const f = optimizationFixture()
  try {
    const input = { requestId: randomUUID(), ...f.guards(), goal }
    const first = executeOperation(f.root, "create_goal", input)
    assert.deepEqual(executeOperation(f.root, "create_goal", input), first)
    assert.deepEqual(f.call("create_goal", { goal }), first)
    assert.throws(() => f.call("create_goal", { goal: { ...goal, title: "Different" } }), /different content/)
    f.call("start_experiment", { experiment: attempt("X-1") })
    const original = f.call("record_experiment_result", { result: result("X-1") })
    assert.deepEqual(f.call("record_experiment_result", { result: result("X-1") }), original)
    assert.throws(() => f.call("record_experiment_result", { result: result("X-1", { measurement: 1 }) }), /different content/)
    assert.equal(getOptimizationGoal(f.root, goal.id).experiments.length, 1)
  } finally { f.cleanup() }
})

test("rejects poison and invalid transitions without partial optimization history", () => {
  const f = optimizationFixture()
  try {
    for (const invalid of [{ ...goal, id: "../../bad" }, { ...goal, metric: { ...goal.metric, baseline: Infinity } }, { ...goal, maxExperiments: -1 }]) {
      assert.throws(() => f.call("create_goal", { goal: invalid }), /invalid operation input/)
    }
    assert.equal(existsSync(join(f.root, ".spec-ledger/optimization")), false)
    f.call("create_goal", { goal })
    assert.throws(() => f.call("record_experiment_result", { result: result("X-missing") }), /not found/)
    assert.throws(() => f.call("start_experiment", { experiment: attempt("X-1", { parentExperimentId: "X-absent" }) }), /parent/)
    f.call("start_experiment", { experiment: attempt("X-1") })
    assert.throws(() => f.call("conclude_goal", { conclusion: { goalId: goal.id, turnId: "T-001", reason: "stopped", summary: "Stop" } }), /pending/)
    for (const extra of [{ status: "failed" }, { measurement: NaN }, { status: "failed", measurement: undefined, decision: "kept" }]) {
      assert.throws(() => f.call("record_experiment_result", { result: result("X-1", extra) }), /invalid operation input/)
    }
    assert.equal(getOptimizationGoal(f.root, goal.id).experiments[0].result, null)
    f.call("record_experiment_result", { result: result("X-1") })
    f.call("conclude_goal", { conclusion: { goalId: goal.id, turnId: "T-001", reason: "stopped", summary: "Stop" } })
    assert.throws(() => f.call("start_experiment", { experiment: attempt("X-2") }), /concluded/)
  } finally { f.cleanup() }
})

test("goals continue on later authorized turns; closed, stale and revoked tasks cannot add history", () => {
  const f = optimizationFixture()
  try {
    f.call("create_goal", { goal })
    f.call("finish_turn", { turnId: "T-001", action: "abandon" })
    assert.throws(() => f.call("start_experiment", { experiment: attempt("X-closed") }), /open turn/)
    f.call("begin_work", { workstreamId: "W-001", sliceId: "SLC-01", turnId: "T-002", goal: "Continue experiments", expectedSourceDigest: undefined, allowDirty: true })
    f.call("start_experiment", { experiment: attempt("X-next", { turnId: "T-002" }) })
    assert.equal(listOptimizationGoals(f.root, { turnId: "T-002" }).length, 1)
    assert.equal(listOptimizationGoals(f.root, { turnId: "T-999" }).length, 0)
    assert.throws(() => f.call("record_experiment_result", { result: result("X-next", { turnId: "T-002" }), expectedRevisionDigest: "0".repeat(64) }), /current executable plan/)
    recordAuthority(f.root, { action: "revoke", targetId: "AUTH-fixture", source: { kind: "agent-reported", reference: "Fixture revocation" } })
    assert.throws(() => f.call("record_experiment_result", { result: result("X-next", { turnId: "T-002" }) }), /not authorized/)
  } finally { f.cleanup() }
})

test("qualitative goals and maximizing metrics do not manufacture a score", () => {
  const f = optimizationFixture()
  try {
    f.call("create_goal", { goal: { ...goal, metric: undefined } })
    f.call("start_experiment", { experiment: attempt("X-1") })
    assert.throws(() => f.call("record_experiment_result", { result: result("X-1") }), /qualitative/)
    f.call("record_experiment_result", { result: result("X-1", { measurement: undefined }) })
    assert.equal(getOptimizationGoal(f.root, goal.id).bestObserved, null)
    assert.equal(getOptimizationGoal(f.root, goal.id).targetObserved, null)
    f.call("create_goal", { goal: { ...goal, id: "G-quality", metric: { ...goal.metric, direction: "maximize", baseline: 0, target: 0.9 } } })
    f.call("start_experiment", { experiment: attempt("X-1", { goalId: "G-quality" }) })
    f.call("record_experiment_result", { result: result("X-1", { goalId: "G-quality", measurement: 0.95 }) })
    assert.equal(getOptimizationGoal(f.root, "G-quality").bestKept?.value, 0.95)
    assert.equal(getOptimizationGoal(f.root, "G-quality").targetObserved, true)
  } finally { f.cleanup() }
})

test("optimization storage refuses symlink reads and writes", () => {
  const f = optimizationFixture(), outside = mkdtempSync(join(tmpdir(), "sl-outside-"))
  try {
    symlinkSync(outside, join(f.root, ".spec-ledger/optimization"))
    assert.throws(() => listOptimizationGoals(f.root), /unsafe optimization storage/)
    assert.throws(() => f.call("create_goal", { goal }), /unsafe optimization storage/)
    assert.equal(existsSync(join(outside, goal.id)), false)
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
  try {
    run(["goal", "create"], goal); run(["experiment", "start"], attempt("X-cli")); run(["experiment", "result"], result("X-cli"))
    assert.equal(run(["goal", "show", "--id", goal.id]).bestObserved.value, 120)
    assert.equal(run(["goal", "list", "--turn", "T-001"]).length, 1)
    assert.equal(JSON.parse(readFileSync(join(f.root, ".spec-ledger/optimization/G-latency/results/X-cli.json"), "utf8")).measurement, 120)
  } finally { f.cleanup(); rmSync(inputs, { recursive: true, force: true }) }
})


test("an interrupted unpublished goal and redirected receipt cannot expose partial history", () => {
  const f = optimizationFixture()
  try {
    const dir = join(f.root, ".spec-ledger/optimization/G-unpublished")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "goal.json.interrupted.tmp"), '{"partial":')
    assert.deepEqual(listOptimizationGoals(f.root), [])
    f.call("create_goal", { goal })
    assert.equal(listOptimizationGoals(f.root).length, 1)
    const requestId = randomUUID()
    const sentinel = join(f.root, "receipt-sentinel.json")
    writeFileSync(sentinel, '{}')
    symlinkSync(sentinel, join(f.root, ".spec-ledger/operations", `${requestId}.started.json`))
    assert.throws(() => executeOperation(f.root, "start_experiment", { requestId, ...f.guards(), experiment: attempt("X-redirected") }), /unsafe optimization storage/)
    assert.equal(readFileSync(sentinel, "utf8"), '{}')
    assert.equal(getOptimizationGoal(f.root, goal.id).experiments.length, 0)
  } finally { f.cleanup() }
})
