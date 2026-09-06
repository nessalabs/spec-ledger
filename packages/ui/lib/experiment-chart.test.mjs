import assert from "node:assert/strict"
import { test } from "node:test"
import { experimentChart, formatMeasurement } from "./experiment-chart.mjs"
const project = (values, metric = {}) => ({ goal: { metric }, experiments: values.map((v,i) => ({ experiment: { id: `X-${i+1}` }, result: v === null ? null : { status: "completed", measurement: v, decision: "kept" } })) })
test("chart preserves gaps, zero and a single-point result", () => {
  const p = experimentChart(project([0, null, 2], { baseline: 1, target: 0 }))
  assert.equal(p.points[0].value, 0); assert.equal(p.points[1].y, null)
  assert.deepEqual(p.segments.map(s => s.length), [2,1])
  assert.equal(experimentChart(project([2])).points.length, 1)
  assert.equal(experimentChart(project([])), null)
})
test("equal, negative and extreme finite values retain finite geometry", () => {
  for (const values of [[-1,-1], [0,0], [-1e308,1e308], [1e-308,2e-308]]) {
    const p = experimentChart(project(values))
    for (const point of p.points) { assert.ok(Number.isFinite(point.x)); assert.ok(Number.isFinite(point.y)) }
    for (const tick of p.ticks) assert.ok(Number.isFinite(tick.value))
  }
  assert.notEqual(formatMeasurement(1e-10), "0")
  assert.equal(formatMeasurement(0), "0")
  assert.equal(formatMeasurement(undefined), "—")
})
