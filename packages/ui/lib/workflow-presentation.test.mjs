import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

const ts = createRequire(new URL("../../ledger/package.json", import.meta.url))(
  "typescript",
)
const source = readFileSync(new URL("./workflow-presentation.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { digestLabel, workflowOutputLabel, workflowStatusView } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
)

test("workflow statuses keep blocked and not-applicable out of passing task states", () => {
  assert.deepEqual(workflowStatusView("blocked"), { label: "Blocked", taskStatus: null })
  assert.deepEqual(workflowStatusView("not-applicable"), {
    label: "Not applicable",
    taskStatus: null,
  })
  assert.equal(workflowStatusView("satisfied").taskStatus, "done")
})

test("workflow digest labels stay recognizable without filling the page", () => {
  assert.equal(digestLabel("abc"), "abc")
  assert.equal(digestLabel("1234567890abcdefghijkl"), "1234567890abcdef…")
})

test("workflow output contracts have plain labels", () => {
  assert.equal(workflowOutputLabel("spec-revision"), "Preserved spec")
  assert.equal(workflowOutputLabel("implementation-report"), "Implementation report")
  assert.equal(workflowOutputLabel("check-results"), "Check results")
})
