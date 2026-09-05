import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

const ts = createRequire(new URL("../../ledger/package.json", import.meta.url))(
  "typescript",
)
const source = readFileSync(new URL("./acceptance-progress.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { acceptanceProgress } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
)

test("acceptance progress is indeterminate without criteria", () => {
  assert.deepEqual(acceptanceProgress(0, 0, 0), {
    total: 0,
    verified: 0,
    implemented: 0,
    percent: null,
  })
})

test("acceptance progress separates verified evidence from reported implementation", () => {
  assert.deepEqual(acceptanceProgress(3, 1, 2), {
    total: 3,
    verified: 1,
    implemented: 2,
    percent: 33,
  })
})

test("acceptance progress reaches 100 only when every criterion is verified", () => {
  assert.equal(acceptanceProgress(3, 2.999, 3).percent, 66)
  assert.equal(acceptanceProgress(3, 3, 3).percent, 100)
  assert.deepEqual(acceptanceProgress(2, 8, -1), {
    total: 2,
    verified: 2,
    implemented: 0,
    percent: 100,
  })
})
