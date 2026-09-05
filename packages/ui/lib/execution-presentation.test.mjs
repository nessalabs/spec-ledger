import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

const ts = createRequire(new URL("../../ledger/package.json", import.meta.url))(
  "typescript",
)
const source = readFileSync(new URL("./execution-presentation.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { durationLabel, executionReasonLabel, executionStateLabel } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
)

test("execution copy keeps uncertainty and completion distinct", () => {
  assert.equal(executionStateLabel("uncertain"), "Activity uncertain")
  assert.equal(executionStateLabel("complete"), "Execution complete")
  assert.notEqual(executionStateLabel("complete"), "Verified")
})

test("continuation blockers explain unavailable host controls", () => {
  assert.equal(
    executionReasonLabel("host-resume-unsupported"),
    "This host cannot resume the session.",
  )
  assert.equal(
    executionReasonLabel("inflight-invocation"),
    "A tool invocation may still be running.",
  )
})

test("policy durations are compact without becoming time estimates", () => {
  assert.equal(durationLabel(30_000), "30s")
  assert.equal(durationLabel(600_000), "10m")
  assert.equal(durationLabel(7_200_000), "2h")
})
