// sl-dev-break killers (T-023 / W-005 SLC-04) — falsify publish.yml vs SL-014.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const REPO = join(import.meta.dirname, "../../..")
const PUBLISH = join(REPO, ".github/workflows/publish.yml")
const CI = join(REPO, ".github/workflows/ci.yml")

function loadPublish(): string {
  assert.ok(existsSync(PUBLISH), "publish.yml missing")
  return readFileSync(PUBLISH, "utf8")
}

function onBlock(yaml: string): string {
  const m = yaml.match(/^on:\n([\s\S]*?)(?=\n(?:permissions|jobs|env|concurrency):|\n[a-z])/m)
  assert.ok(m, "on: block required")
  return m[1]
}

describe("publish workflow break (SLC-04 / SL-014)", () => {
  it("live publish only on release: workflow_dispatch must always dry-run (cannot live via dry_run=false)", () => {
    const y = loadPublish()
    // Acceptance + SL-014: live registry write only on release published.
    // inputs.dry_run must never gate live publish (dispatch dry_run=false must not write).
    assert.doesNotMatch(
      y,
      /DRY_RUN:[\s\S]*inputs\.dry_run|inputs\.dry_run[\s\S]*DRY_RUN/,
      "DRY_RUN must not follow inputs.dry_run (dispatch dry_run=false would live-publish)",
    )
    // Non-release events must force dry-run (shell or expression).
    const forcesDryOffRelease =
      /event_name\s*\}\}"\s*!=\s*"release"/.test(y) ||
      /event_name\s*\}\}"\s*!=\s*'release'/.test(y) ||
      /event_name\s*!=\s*'release'/.test(y) ||
      /event_name\s*!=\s*"release"/.test(y)
    assert.ok(
      forcesDryOffRelease,
      "must force dry-run when github.event_name != release",
    )
    assert.match(
      y,
      /DRY_RUN=true/,
      "non-release path must set DRY_RUN=true",
    )
  })

  it("release types are exclusively [published] (no created/edited/prereleased)", () => {
    const y = loadPublish()
    const on = onBlock(y)
    assert.match(on, /release:/)
    // Flow form types: [published] or block form — allow list must be exclusive.
    const flow = on.match(/types:\s*\[([^\]]+)\]/)
    const block = on.match(/types:\s*\n((?:\s*-\s*\w+\s*\n)+)/)
    let names: string[] = []
    if (flow) {
      names = flow[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    } else if (block) {
      names = [...block[1].matchAll(/-\s*(\w+)/g)].map((m) => m[1])
    } else {
      assert.fail("release.types list required")
    }
    assert.deepEqual(
      names,
      ["published"],
      `release.types must be only published; got: ${names.join(",")}`,
    )
    assert.doesNotMatch(on, /\b(created|edited|prereleased|released|unpublished)\b/)
  })

  it("on: triggers are only release + workflow_dispatch (no push/pull_request siblings)", () => {
    const on = onBlock(loadPublish())
    assert.match(on, /release:/)
    assert.match(on, /workflow_dispatch:/)
    assert.doesNotMatch(on, /^\s*push:/m)
    assert.doesNotMatch(on, /^\s*pull_request:/m)
    assert.doesNotMatch(on, /^\s*schedule:/m)
  })

  it("dry_run input defaults to true", () => {
    const y = loadPublish()
    assert.match(y, /dry_run:\s*\n(?:.*\n)*?\s*default:\s*true/)
  })

  it("version mismatch fails closed before publish", () => {
    const y = loadPublish()
    assert.match(y, /version mismatch/)
    assert.match(y, /exit 1/)
    assert.match(y, /packages\/ledger/)
    assert.match(y, /packages\/client/)
    assert.match(y, /packages\/server/)
  })

  it("NPM_TOKEN required for live publish; ci.yml never publishes", () => {
    const y = loadPublish()
    assert.match(y, /secrets\.NPM_TOKEN/)
    assert.match(y, /NPM_TOKEN secret required for live publish/)
    const ci = readFileSync(CI, "utf8")
    assert.doesNotMatch(ci, /npm publish|pnpm publish|NODE_AUTH_TOKEN|NPM_TOKEN/)
  })

  it("published package names are @nessalabs/* and UI is not in the publish loop", () => {
    const y = loadPublish()
    assert.match(y, /scope:\s*"@nessalabs"/)
    for (const pkg of ["ledger", "client", "server"] as const) {
      const name = JSON.parse(
        readFileSync(join(REPO, `packages/${pkg}/package.json`), "utf8"),
      ).name as string
      assert.match(name, /^@nessalabs\//, `${pkg} must be @nessalabs scoped`)
      assert.match(y, new RegExp(`packages/${pkg}`))
    }
    // Out-of-intent: pitch forbids publishing UI to npm in this bet.
    const publishLoop = y.match(
      /for pkg in ([^\n]+)/,
    )
    assert.ok(publishLoop, "publish for-loop required")
    assert.doesNotMatch(publishLoop[1], /packages\/ui/)
    assert.doesNotMatch(y, /pnpm publish[\s\S]*packages\/ui|packages\/ui[\s\S]*pnpm publish/)
  })
})
