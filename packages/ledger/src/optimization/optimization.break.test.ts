import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync, writeFileSync, symlinkSync, unlinkSync, existsSync } from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { optimizationFixture } from "./optimization.fixture.js"
import { getOptimizationGoal } from "./index.js"

const goalInput = { title: "Break history", objective: "Keep trustworthy observations", stopWhen: "Two attempts", maxExperiments: 2,
  metric: { name: "Score", unit: "points", direction: "maximize", protocol: "Same inputs", baseline: 0 } }
function setup() {
 const f=optimizationFixture()
 const input={...goalInput,workstreamId:f.workstreamId,turnId:f.turnId}
 const goal=f.call("create_goal",{goal:input}) as {id:string}
 const attempt=(extra={})=>({goalId:goal.id,turnId:f.turnId,hypothesis:"Change improves score",change:"Candidate implementation",...extra})
 const start=(extra={})=>f.call("start_experiment",{experiment:attempt(extra)}) as {id:string}
 const result=(id:string,extra={})=>({goalId:goal.id,experimentId:id,turnId:f.turnId,status:"completed",decision:"kept",measurement:1,findings:"Measured candidate",...extra})
 return {...f,goal,input,attempt,start,result}
}
test("breaker: a rejected stale-source write leaves no experiment and can retry with fresh guards", () => {
  const f = setup()
  try {
    const stale = f.guards(), requestId=randomUUID(), experiment=f.attempt()
    writeFileSync(join(f.root, "system.ts"), "export const version = 2\n")
    assert.throws(() => f.call("start_experiment", { requestId,experiment,...stale }), /source/i)
    assert.equal(getOptimizationGoal(f.root, f.goal.id).experiments.length, 0)
    f.call("start_experiment",{experiment})
    assert.equal(getOptimizationGoal(f.root, f.goal.id).experiments[0].experiment.sequence, 1)
  } finally { f.cleanup() }
})
test("breaker: pending parents and cross-workstream references cannot consume an attempt", () => {
  const f = optimizationFixture()
  try {
    assert.throws(() => f.call("create_goal", { goal: { ...goalInput, turnId:f.turnId,workstreamId:randomUUID() } }), /workstream|turn/)
    assert.equal(existsSync(join(f.root, ".spec-ledger/optimization")), false)
    const goal=f.call("create_goal",{goal:{...goalInput,workstreamId:f.workstreamId,turnId:f.turnId}}) as {id:string}
    const attempt={goalId:goal.id,turnId:f.turnId,hypothesis:"Candidate",change:"Implementation"}
    const first=f.call("start_experiment",{experiment:attempt}) as {id:string}
    assert.throws(() => f.call("start_experiment", { experiment:{...attempt,parentExperimentId:first.id} }), /parent/)
    assert.equal(getOptimizationGoal(f.root, goal.id).remainingExperiments, 1)
    f.call("record_experiment_result", { result: {goalId:goal.id,experimentId:first.id,turnId:f.turnId,status:"completed",decision:"kept",measurement:1,findings:"Measured candidate"} })
    f.call("start_experiment", { experiment:{...attempt,parentExperimentId:first.id} })
    assert.equal(getOptimizationGoal(f.root, goal.id).remainingExperiments, 0)
  } finally { f.cleanup() }
})
test("breaker: corrupt identity and orphan result history fail closed on reads and new writes", () => {
  const f = setup()
  try {
    const first=f.start();f.call("record_experiment_result",{result:f.result(first.id)})
    const file = join(f.root, `.spec-ledger/optimization/${f.goal.id}/results/${first.id}.json`)
    const original = readFileSync(file, "utf8")
    writeFileSync(file, JSON.stringify({ ...JSON.parse(original), goalId: randomUUID() }))
    assert.throws(() => getOptimizationGoal(f.root, f.goal.id), /mismatched/)
    assert.throws(() => f.start(), /mismatched/)
    writeFileSync(file, original)
    const orphan=randomUUID()
    writeFileSync(join(f.root, `.spec-ledger/optimization/${f.goal.id}/results/${orphan}.json`), JSON.stringify({ ...JSON.parse(original), experimentId:orphan }))
    assert.throws(() => getOptimizationGoal(f.root, f.goal.id), /orphan/)
    assert.throws(() => f.start(), /orphan/)
  } finally { f.cleanup() }
})
test("breaker: a result-file symlink is rejected without modifying its target", () => {
  const f = setup()
  try {
    const first=f.start();const result=f.result(first.id)
    f.call("record_experiment_result", { result })
    const file = join(f.root, `.spec-ledger/optimization/${f.goal.id}/results/${first.id}.json`)
    const outside = join(f.root, "sentinel.json")
    const original = readFileSync(file, "utf8")
    writeFileSync(outside, original); unlinkSync(file); symlinkSync(outside, file)
    assert.throws(() => getOptimizationGoal(f.root, f.goal.id), /unsafe optimization storage/)
    assert.throws(() => f.call("record_experiment_result", { result }), /unsafe optimization storage/)
    assert.equal(readFileSync(outside, "utf8"), original)
  } finally { f.cleanup() }
})
// Single out-of-intent killer: a machine clock moving backward must not reorder attempts.
test("breaker: clock rollback never reorders attempts or changes latest attempt measurement", context => {
  const f = setup()
  try {
    context.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-09-06T10:00:00.000Z") })
    const first=f.start();f.call("record_experiment_result", { result: f.result(first.id, { measurement: 10 }) })
    context.mock.timers.setTime(Date.parse("2026-09-06T09:00:00.000Z"))
    const second=f.start();f.call("record_experiment_result", { result: f.result(second.id, { measurement: 5, decision: "discarded" }) })
    const projection = getOptimizationGoal(f.root, f.goal.id)
    assert.deepEqual(projection.experiments.map(e => e.experiment.id), [first.id,second.id])
    assert.equal(projection.latest?.value, 5)
    assert.equal(projection.bestKept?.value, 10)
    assert.equal(projection.bestObserved?.value, 10)
  } finally { context.mock.timers.reset(); f.cleanup() }
})
