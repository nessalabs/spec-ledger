import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const REPO = join(import.meta.dirname, "../../../..")
const REVIEWS = join(REPO, ".spec-ledger/reviews")

function walkJson(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walkJson(p))
    else if (name.endsWith(".json")) out.push(p)
  }
  return out
}

describe("dogfood reviews vs schemas/review.json", () => {
  it("every on-disk review has Lattice copy and code-break evidence rules", () => {
    const files = walkJson(REVIEWS)
    assert.ok(files.length >= 20, `expected retrofitted reviews, got ${files.length}`)
    for (const file of files) {
      const d = JSON.parse(readFileSync(file, "utf8")) as {
        id: string
        kind?: string
        target?: string
        verdict?: string
        plainSummary?: string
        killersCited?: string[]
        findings?: Array<{
          id: string
          plainImpact?: string
          evidence?: { kind?: string }
        }>
      }
      const label = file.slice(REPO.length + 1)
      assert.equal(typeof d.plainSummary, "string", `${label}: plainSummary`)
      assert.ok(d.plainSummary!.trim().length >= 1, `${label}: empty plainSummary`)
      assert.ok(d.plainSummary!.length <= 280, `${label}: plainSummary >280`)
      const findings = d.findings ?? []
      for (const f of findings) {
        assert.equal(typeof f.plainImpact, "string", `${label} ${f.id}: plainImpact`)
        assert.ok(f.plainImpact!.trim().length >= 1, `${label} ${f.id}: empty plainImpact`)
        assert.ok(f.plainImpact!.length <= 280, `${label} ${f.id}: plainImpact >280`)
      }
      if (d.kind === "adversarial" && d.target === "code") {
        for (const f of findings) {
          assert.ok(f.evidence, `${label} ${f.id}: code-adversarial finding needs evidence`)
        }
        if (d.verdict === "approve") {
          assert.ok(
            Array.isArray(d.killersCited) && d.killersCited.length > 0,
            `${label}: code-adversarial approve needs killersCited`,
          )
        }
      }
    }
  })
})
