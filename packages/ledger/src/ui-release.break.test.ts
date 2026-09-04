// sl-dev-break killers (T-024 / W-005 SLC-03) — falsify UI Release asset vs SL-013.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { REPO, uiReleaseFixture } from "./ui-release.fixture.js"
const PACK = join(REPO, "scripts/pack-ui-release.mjs")
const PUBLISH = join(REPO, ".github/workflows/publish.yml")
const README = join(REPO, "README.md")

/** Walk every package.json, including under node_modules (smoke skips those). */
function walkAllPackageJson(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === ".next") continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walkAllPackageJson(p, out)
    else if (name === "package.json") out.push(p)
  }
  return out
}

function readmeUiSection(): string {
  const readme = readFileSync(README, "utf8")
  const start = readme.indexOf("### Spec Ledger UI from a Release asset")
  assert.ok(start >= 0, "README missing Spec Ledger UI Release asset section")
  const rest = readme.slice(start)
  const next = rest.search(/\n## /)
  return next >= 0 ? rest.slice(0, next) : rest
}

describe("UI release break (T-024 SLC-03 / SL-013)", () => {
  it("shipped tree incl node_modules has zero file:/workspace: protocols", () => {
    const fixture = uiReleaseFixture()
    const out = mkdtempSync(join(tmpdir(), "sl-ui-break-out-"))
    let extract = ""
    try {
      const r = spawnSync(
        "node",
        [fixture.pack, "--skip-build", "--out", out],
        { encoding: "utf8", cwd: fixture.root, env: fixture.env },
      )
      assert.equal(r.status, 0, r.stderr || r.stdout)
      const tgz = readdirSync(out).find(
        (f) => f.startsWith("spec-ledger-ui-") && f.endsWith(".tgz"),
      )
      assert.ok(tgz, `missing tarball in ${out}`)
      extract = mkdtempSync(join(tmpdir(), "sl-ui-break-x-"))
      const x = spawnSync("tar", ["-xzf", join(out, tgz!), "-C", extract], {
        encoding: "utf8",
      })
      assert.equal(x.status, 0, x.stderr)
      const app = join(extract, "spec-ledger-ui")
      assert.ok(
        existsSync(join(app, "node_modules")),
        "shipped tree must vendor node_modules",
      )
      const bad: string[] = []
      for (const pj of walkAllPackageJson(app)) {
        const txt = readFileSync(pj, "utf8")
        if (txt.includes("workspace:") || /"file:/.test(txt)) bad.push(pj)
      }
      assert.equal(
        bad.length,
        0,
        `file:/workspace: still present under shipped tree (incl node_modules):\n${bad.slice(0, 15).join("\n")}`,
      )
    } finally {
      rmSync(out, { recursive: true, force: true })
      if (extract) rmSync(extract, { recursive: true, force: true })
      fixture.cleanup()
    }
  })

  it("README documents published client/server + Release UI asset (SLC-03 acceptance)", () => {
    const section = readmeUiSection()
    assert.match(section, /spec-ledger-ui-.*\.tgz/)
    assert.match(
      section,
      /@nessalabs\/spec-ledger-client/,
      "UI section must mention published client",
    )
    // Sealed W-005 SLC-03: "published client/server + Release Spec Ledger UI asset"
    assert.match(
      section,
      /@nessalabs\/spec-ledger-server/,
      "UI section must mention published server (sealed acceptance / SL-013)",
    )
    // Path B: must not tell consumers to npm-install unpublished @nessalabs/ui
    assert.doesNotMatch(
      section,
      /npm\s+i(?:nstall)?[^\n]*@nessalabs\/ui/,
      "must not instruct npm install of unpublished @nessalabs/ui",
    )
  })

  it("publish.yml packs UI Release asset with NESSA_UI_ROOT, dist build, no --skip-build, contents:write upload", () => {
    const y = readFileSync(PUBLISH, "utf8")
    assert.match(
      y,
      /contents:\s*write/,
      "contents:write required to upload Release assets",
    )
    assert.doesNotMatch(
      y,
      /contents:\s*read\b/,
      "contents:read alone cannot upload Release assets",
    )
    assert.match(y, /NESSA_UI_ROOT:/)
    assert.match(y, /nessa_ui/)
    assert.match(
      y,
      /pnpm --filter @nessalabs\/agent-stream --filter @nessalabs\/ui build/,
      "must build nessa_ui dist before pack",
    )
    assert.match(y, /pack-ui-release\.mjs/)
    assert.doesNotMatch(
      y,
      /pack-ui-release\.mjs[^\n]*--skip-build/,
      "Release pack must run next build (no --skip-build)",
    )
    assert.match(y, /dist-ui-release\/spec-ledger-ui-\*\.tgz/)
    assert.match(y, /Upload UI Release asset/)
    const build = y.indexOf("- name: Build nessa_ui packages")
    const pack = y.indexOf("- name: Pack Spec Ledger UI Release asset")
    const publish = y.indexOf("- name: Publish packages")
    assert.ok(build >= 0 && build < pack && pack < publish,
      "build and pack the real release UI before any npm package is published")
  })

  it("pack-ui-release fails closed when NESSA_UI_ROOT / agent-stream missing", () => {
    const out = mkdtempSync(join(tmpdir(), "sl-ui-break-fail-"))
    const partial = mkdtempSync(join(tmpdir(), "nessa-ui-partial-"))
    try {
      const missingRoot = spawnSync(
        "node",
        [PACK, "--skip-build", "--out", out],
        {
          encoding: "utf8",
          cwd: REPO,
          env: {
            ...process.env,
            NESSA_UI_ROOT: join(tmpdir(), "no-such-nessa-ui"),
          },
        },
      )
      assert.notEqual(
        missingRoot.status,
        0,
        "must fail when NESSA_UI_ROOT missing",
      )
      assert.match(
        missingRoot.stderr || missingRoot.stdout || "",
        /NESSA_UI_ROOT|missing @nessalabs\/ui/,
        "error must name NESSA_UI_ROOT / missing ui",
      )

      const react = join(partial, "packages/react")
      mkdirSync(react, { recursive: true })
      writeFileSync(
        join(react, "package.json"),
        JSON.stringify({ name: "@nessalabs/ui", version: "0.0.0" }),
      )
      const missingAgent = spawnSync(
        "node",
        [PACK, "--skip-build", "--out", out],
        {
          encoding: "utf8",
          cwd: REPO,
          env: { ...process.env, NESSA_UI_ROOT: partial },
        },
      )
      assert.notEqual(
        missingAgent.status,
        0,
        "must fail when agent-stream missing",
      )
      assert.match(
        missingAgent.stderr || missingAgent.stdout || "",
        /agent-stream/,
        "must not pack a registry-404 path without agent-stream",
      )
    } finally {
      rmSync(out, { recursive: true, force: true })
      rmSync(partial, { recursive: true, force: true })
    }
  })

  // Out-of-intent (builder did not name): leftover @nessa scope / version mismatch
  it("packaged UI name/deps stay @nessalabs/* and tarball version matches ledger", () => {
    const fixture = uiReleaseFixture()
    const out = mkdtempSync(join(tmpdir(), "sl-ui-break-scope-"))
    let extract = ""
    try {
      const r = spawnSync(
        "node",
        [fixture.pack, "--skip-build", "--out", out],
        { encoding: "utf8", cwd: fixture.root, env: fixture.env },
      )
      assert.equal(r.status, 0, r.stderr || r.stdout)
      const ledgerVer = JSON.parse(
        readFileSync(join(REPO, "packages/ledger/package.json"), "utf8"),
      ).version as string
      const tgz = readdirSync(out).find(
        (f) => f.startsWith("spec-ledger-ui-") && f.endsWith(".tgz"),
      )
      assert.equal(tgz, `spec-ledger-ui-${ledgerVer}.tgz`)
      extract = mkdtempSync(join(tmpdir(), "sl-ui-break-scope-x-"))
      spawnSync("tar", ["-xzf", join(out, tgz!), "-C", extract], {
        encoding: "utf8",
      })
      const pkg = JSON.parse(
        readFileSync(join(extract, "spec-ledger-ui/package.json"), "utf8"),
      ) as {
        name: string
        version: string
        dependencies?: Record<string, string>
      }
      assert.equal(pkg.version, ledgerVer)
      assert.match(pkg.name, /^@nessalabs\//)
      assert.doesNotMatch(pkg.name, /^@nessa(?!labs)\//)
      for (const [name, ver] of Object.entries(pkg.dependencies ?? {})) {
        if (/^@nessa(?!labs)\//.test(name)) {
          assert.fail(`leftover @nessa scope dep: ${name}=${ver}`)
        }
      }
    } finally {
      rmSync(out, { recursive: true, force: true })
      if (extract) rmSync(extract, { recursive: true, force: true })
      fixture.cleanup()
    }
  })
})
