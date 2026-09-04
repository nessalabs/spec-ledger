import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const REPO = join(import.meta.dirname, "../../..")

function walkPackageJson(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walkPackageJson(p, out)
    else if (name === "package.json") out.push(p)
  }
  return out
}

describe("UI release asset (SLC-03)", () => {
  it("pack-ui-release --skip-build ships a tree with zero file:/workspace: deps", () => {
    const out = mkdtempSync(join(tmpdir(), "sl-ui-out-"))
    try {
      const r = spawnSync(
        "node",
        [join(REPO, "scripts/pack-ui-release.mjs"), "--skip-build", "--out", out],
        { encoding: "utf8", cwd: REPO },
      )
      assert.equal(r.status, 0, r.stderr || r.stdout)
      const tgz = readdirSync(out).find((f) => f.startsWith("spec-ledger-ui-") && f.endsWith(".tgz"))
      assert.ok(tgz, `missing tarball in ${out}: ${r.stdout}`)

      const extract = mkdtempSync(join(tmpdir(), "sl-ui-x-"))
      spawnSync("tar", ["-xzf", join(out, tgz), "-C", extract], { encoding: "utf8" })
      const app = join(extract, "spec-ledger-ui")
      assert.ok(existsSync(app))
      for (const pj of walkPackageJson(app)) {
        const txt = readFileSync(pj, "utf8")
        assert.ok(!txt.includes("workspace:"), pj)
        assert.ok(!/"file:/.test(txt), pj)
      }
      rmSync(extract, { recursive: true, force: true })
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  it("README documents consumer one-liner for Release UI asset", () => {
    const readme = readFileSync(join(REPO, "README.md"), "utf8")
    assert.match(readme, /spec-ledger-ui-.*\.tgz/)
    assert.match(readme, /@nessalabs\/spec-ledger-client/)
    assert.match(readme, /SPEC_LEDGER_ROOT/)
    assert.match(readme, /pack-ui-release/)
    assert.match(readme, /@nessalabs\/spec-ledger@/)
  })
})
