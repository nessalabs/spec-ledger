// sl-dev-break killers (T-020 / W-005 SLC-01) — falsify init against sealed path table.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { INIT_EMPTY_DIRS, initLedgerDetailed } from "./init.js"
import { loadLedger } from "../fs/load.js"
import { verifyLedger } from "../verify/verify.js"

const CLI = fileURLToPath(new URL("../../dist/cli/main.js", import.meta.url))

/** Normative top-level entries under `.spec-ledger/` (pitch table). */
const NORMATIVE_TOP = new Set([
  "ledger.json",
  "vision.json",
  "claims",
  "bindings",
  "graph",
  "policy",
  "results",
  "turns",
  "workstreams",
  "proposed-claims",
  "reviews",
  "themes",
  "tenets",
])

function freshGit(): string {
  const dir = mkdtempSync(join(tmpdir(), "sl-init-break-"))
  spawnSync("git", ["init", "-q"], { cwd: dir })
  return dir
}

function listRecursiveFiles(root: string, rel = ""): string[] {
  const abs = rel ? join(root, rel) : root
  const out: string[] = []
  for (const name of readdirSync(abs)) {
    const childRel = rel ? `${rel}/${name}` : name
    const childAbs = join(root, childRel)
    if (statSync(childAbs).isDirectory()) {
      out.push(...listRecursiveFiles(root, childRel))
    } else {
      out.push(childRel)
    }
  }
  return out.sort()
}

describe("sl-dev-break init (T-020 / SLC-01)", () => {
  it("exact normative top-level set — no extras, no missing", () => {
    const dir = freshGit()
    const { path } = initLedgerDetailed(dir, "exact")
    const top = new Set(readdirSync(path))
    assert.deepEqual(
      [...top].sort(),
      [...NORMATIVE_TOP].sort(),
      `top-level drift: extra=[...${[...top].filter((x) => !NORMATIVE_TOP.has(x))}] missing=[${[...NORMATIVE_TOP].filter((x) => !top.has(x))}]`,
    )
    assert.deepEqual(readdirSync(join(path, "graph")), ["codebase-graph.json"])
    assert.deepEqual(readdirSync(join(path, "policy")), ["layers.json"])
    assert.deepEqual(readdirSync(join(path, "results")), [".gitkeep"])
    for (const d of INIT_EMPTY_DIRS) {
      assert.deepEqual(readdirSync(join(path, d)), [], `${d} must be empty`)
    }
    const files = listRecursiveFiles(path)
    assert.ok(!files.some((f) => f.startsWith("schemas")), "schemas must not be copied")
    assert.ok(!files.some((f) => f.includes("claims/") && f.endsWith(".json")))
    assert.ok(!files.some((f) => f.includes("bindings/") && f.endsWith(".json")))
  })

  it("re-init refuse must not clobber existing skeleton", () => {
    const dir = freshGit()
    const { path } = initLedgerDetailed(dir, "once")
    const visionBefore = readFileSync(join(path, "vision.json"), "utf8")
    const ledgerBefore = readFileSync(join(path, "ledger.json"), "utf8")
    writeFileSync(join(path, "claims", "marker.txt"), "keep")
    assert.throws(() => initLedgerDetailed(dir, "clobber-me"), /already initialized/)
    assert.equal(readFileSync(join(path, "vision.json"), "utf8"), visionBefore)
    assert.equal(readFileSync(join(path, "ledger.json"), "utf8"), ledgerBefore)
    assert.equal(readFileSync(join(path, "claims", "marker.txt"), "utf8"), "keep")
    const ledger = JSON.parse(ledgerBefore) as { name: string }
    assert.equal(ledger.name, "once")
  })

  it("partial failure before ledger.json must leave re-init gate unset", () => {
    const dir = freshGit()
    const root = join(dir, ".spec-ledger")
    mkdirSync(root, { recursive: true })
    // Block graph file write: `graph` exists as a plain file (not a directory).
    writeFileSync(join(root, "graph"), "not-a-directory")
    assert.throws(() => initLedgerDetailed(dir, "partial"))
    assert.equal(
      existsSync(join(root, "ledger.json")),
      false,
      "ledger.json must not exist after partial failure",
    )
  })

  it("verify after init: no invented pass; no binding status/pass fields", () => {
    const dir = freshGit()
    initLedgerDetailed(dir, "honest")
    const loaded = loadLedger(dir)
    assert.equal(loaded.claims.length, 0)
    assert.equal(loaded.bindings.length, 0)
    const report = verifyLedger(loaded)
    assert.ok(!report.claims.some((c) => c.outcome === "pass"))
    for (const b of loaded.bindings) {
      const raw = b as unknown as Record<string, unknown>
      assert.ok(!("status" in raw), "binding must not carry status")
      assert.ok(!("pass" in raw), "binding must not carry pass")
    }
    const bindingFiles = listRecursiveFiles(join(dir, ".spec-ledger", "bindings"))
    assert.deepEqual(bindingFiles, [])
  })

  it("git prefer: init from subdirectory lands at repo-root .spec-ledger", () => {
    const dir = freshGit()
    const sub = join(dir, "packages", "app")
    mkdirSync(sub, { recursive: true })
    const { path, warnings } = initLedgerDetailed(sub, "nested")
    assert.equal(path, join(dir, ".spec-ledger"))
    assert.equal(existsSync(join(sub, ".spec-ledger")), false)
    assert.equal(warnings.length, 0)
  })

  it("poison: nested empty .spec-ledger must not win over parent .git", () => {
    // Menu: poison input / wrong principal — findRepoRoot returns early on
    // LEDGER_DIR before walking to .git, so a leftover nested dir hijacks init.
    const dir = freshGit()
    const sub = join(dir, "packages", "app")
    mkdirSync(join(sub, ".spec-ledger"), { recursive: true })
    const { path } = initLedgerDetailed(sub, "hijack")
    assert.equal(
      path,
      join(dir, ".spec-ledger"),
      `nested .spec-ledger hijacked init → ${path} (want repo-root)`,
    )
    assert.equal(
      existsSync(join(sub, ".spec-ledger", "ledger.json")),
      false,
      "must not stamp ledger.json under nested leftover .spec-ledger",
    )
    assert.ok(existsSync(join(dir, ".spec-ledger", "ledger.json")))
  })

  it("CLI re-init exits non-zero and prints already initialized", () => {
    const dir = freshGit()
    const first = spawnSync(process.execPath, [CLI, "init", "--root", dir, "--name", "cli"], {
      encoding: "utf8",
    })
    assert.equal(first.status, 0, first.stderr || first.stdout)
    const second = spawnSync(process.execPath, [CLI, "init", "--root", dir, "--name", "again"], {
      encoding: "utf8",
    })
    assert.notEqual(second.status, 0, "re-init must be non-zero")
    assert.match(`${second.stderr}\n${second.stdout}`, /already initialized/)
  })

  it("CLI no-.git prints one-line warning then initializes at cwd", () => {
    const dir = mkdtempSync(join(tmpdir(), "sl-init-nogit-cli-"))
    const r = spawnSync(process.execPath, [CLI, "init", "--root", dir, "--name", "nogit"], {
      encoding: "utf8",
    })
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(`${r.stderr}\n${r.stdout}`, /no \.git/)
    assert.ok(existsSync(join(dir, ".spec-ledger", "ledger.json")))
  })

  // Out-of-intent (builder did not name): vision.json blocked → still no ledger.json
  it("out-of-intent: vision write failure must not leave ledger.json", () => {
    const dir = freshGit()
    const root = join(dir, ".spec-ledger")
    mkdirSync(root, { recursive: true })
    // vision.json as a directory → writeFileSync(vision.json) fails after dirs/graph/policy
    mkdirSync(join(root, "vision.json"), { recursive: true })
    assert.throws(() => initLedgerDetailed(dir, "vision-block"))
    assert.equal(
      existsSync(join(root, "ledger.json")),
      false,
      "ledger.json written despite vision failure — gate ordering broken",
    )
  })
})
