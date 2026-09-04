import { test } from "node:test"
import assert from "node:assert/strict"

test("graph display rejects the incomplete session fixture instead of iterating missing layers", async () => {
  const { graphDisplayIssue } = await import(new URL("../../../client/dist/graph-shape.js", import.meta.url).href)
  assert.match(graphDisplayIssue({ nodes: [], edges: [], features: [] }), /incomplete/)
  assert.match(graphDisplayIssue({ system: { revision: "1" }, nodes: [], edges: [], features: [] }), /layers/)
  assert.match(graphDisplayIssue({ system: { revision: "1" }, layers: {}, nodes: [], edges: [], features: [] }), /layers/)
  assert.match(graphDisplayIssue({ system: { revision: "1" }, layers: [], nodes: [null], edges: [], features: [] }), /entries/)
  assert.equal(graphDisplayIssue({ system: { revision: "1" }, layers: [], nodes: [], edges: [], features: [] }), null)
  assert.equal(graphDisplayIssue({ system: { revision: "1" }, layers: [], nodes: [{ id: "unnamed", layer: "core" }], edges: [], features: [] }), null)
})
