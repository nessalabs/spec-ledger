import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync, writeFileSync, symlinkSync, unlinkSync, existsSync } from "node:fs"
import { join } from "node:path"
import { optimizationFixture } from "./optimization.fixture.js"
import { getOptimizationGoal } from "./index.js"

const goal = { id: "G-break", workstreamId: "W-001", turnId: "T-001", title: "Break history", objective: "Keep trustworthy observations", stopWhen: "Two attempts", maxExperiments: 2,
  metric: { name: "Score", unit: "points", direction: "maximize", protocol: "Same inputs", baseline: 0 } }
const attempt = (id: string, extra = {}) => ({ id, goalId: goal.id, turnId: "T-001", hypothesis: "Change improves score", change: "Candidate implementation", ...extra })
const result = (id: string, extra = {}) => ({ goalId: goal.id, experimentId: id, turnId: "T-001", status: "completed", decision: "kept", measurement: 1, findings: "Measured candidate", ...extra })

test("breaker: a rejected stale-source write leaves no experiment and can retry with fresh guards", () => {
  const f = optimizationFixture()
  try {
    f.call("create_goal", { goal })
    const stale = f.guards()
    writeFileSync(join(f.root, "system.ts"), "export const version = 2\n")
    assert.throws(() => f.call("start_experiment", { experiment: attempt("X-1"), ...stale }), /source/i)
    assert.equal(getOptimizationGoal(f.root, goal.id).experiments.length, 0)
    f.call("start_experiment", { experiment: attempt("X-1") })
    assert.equal(getOptimizationGoal(f.root, goal.id).experiments[0].experiment.sequence, 1)
  } finally { f.cleanup() }
})

test("breaker: pending parents and cross-workstream references cannot consume an attempt", () => {
  const f = optimizationFixture()
  try {
    assert.throws(() => f.call("create_goal", { goal: { ...goal, workstreamId: "W-999" } }), /workstream|turn/)
    assert.equal(existsSync(join(f.root, ".spec-ledger/optimization/G-break/goal.json")), false)
    f.call("create_goal", { goal })
    f.call("start_experiment", { experiment: attempt("X-1") })
    assert.throws(() => f.call("start_experiment", { experiment: attempt("X-2", { parentExperimentId: "X-1" }) }), /parent/)
    assert.equal(getOptimizationGoal(f.root, goal.id).remainingExperiments, 1)
    f.call("record_experiment_result", { result: result("X-1") })
    f.call("start_experiment", { experiment: attempt("X-2", { parentExperimentId: "X-1" }) })
    assert.equal(getOptimizationGoal(f.root, goal.id).remainingExperiments, 0)
  } finally { f.cleanup() }
})

test("breaker: corrupt identity and orphan result history fail closed on reads and new writes", () => {
  const f = optimizationFixture()
  try {
    f.call("create_goal", { goal })
    f.call("start_experiment", { experiment: attempt("X-1") })
    f.call("record_experiment_result", { result: result("X-1") })
    const file = join(f.root, ".spec-ledger/optimization/G-break/results/X-1.json")
    const original = readFileSync(file, "utf8")
    writeFileSync(file, JSON.stringify({ ...JSON.parse(original), goalId: "G-other" }))
    assert.throws(() => getOptimizationGoal(f.root, goal.id), /mismatched/)
    assert.throws(() => f.call("start_experiment", { experiment: attempt("X-2") }), /mismatched/)
    writeFileSync(file, original)
    writeFileSync(join(f.root, ".spec-ledger/optimization/G-break/results/X-orphan.json"), JSON.stringify({ ...JSON.parse(original), experimentId: "X-orphan" }))
    assert.throws(() => getOptimizationGoal(f.root, goal.id), /orphan/)
    assert.throws(() => f.call("start_experiment", { experiment: attempt("X-2") }), /orphan/)
  } finally { f.cleanup() }
})

test("breaker: a result-file symlink is rejected without modifying its target", () => {
  const f = optimizationFixture()
  try {
    f.call("create_goal", { goal })
    f.call("start_experiment", { experiment: attempt("X-1") })
    f.call("record_experiment_result", { result: result("X-1") })
    const file = join(f.root, ".spec-ledger/optimization/G-break/results/X-1.json")
    const outside = join(f.root, "sentinel.json")
    const original = readFileSync(file, "utf8")
    writeFileSync(outside, original); unlinkSync(file); symlinkSync(outside, file)
    assert.throws(() => getOptimizationGoal(f.root, goal.id), /unsafe optimization storage/)
    assert.throws(() => f.call("record_experiment_result", { result: result("X-1") }), /unsafe optimization storage/)
    assert.equal(readFileSync(outside, "utf8"), original)
  } finally { f.cleanup() }
})

// Single out-of-intent killer: a machine clock moving backward must not reorder attempts.
test("breaker: clock rollback never reorders attempts or changes latest attempt measurement", context => {
  const f = optimizationFixture()
  try {
    context.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-09-06T10:00:00.000Z") })
    f.call("create_goal", { goal })
    f.call("start_experiment", { experiment: attempt("X-z") })
    f.call("record_experiment_result", { result: result("X-z", { measurement: 10 }) })
    context.mock.timers.setTime(Date.parse("2026-09-06T09:00:00.000Z"))
    f.call("start_experiment", { experiment: attempt("X-a") })
    f.call("record_experiment_result", { result: result("X-a", { measurement: 5, decision: "discarded" }) })
    const projection = getOptimizationGoal(f.root, goal.id)
    assert.deepEqual(projection.experiments.map(e => e.experiment.id), ["X-z", "X-a"])
    assert.equal(projection.latest?.value, 5)
    assert.equal(projection.bestKept?.value, 10)
    assert.equal(projection.bestObserved?.value, 10)
  } finally { context.mock.timers.reset(); f.cleanup() }
})
