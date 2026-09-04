// sl-dev-break killers (T-021 / W-005 SLC-05) — falsify sealed plan digests.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  existsSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { initLedger } from "../cli/init.js"
import { auditLedger } from "../audit/audit.js"
import {
  amendWorkstream,
  backfillDocDigest,
  checkSeal,
  computeSpecDigest,
  sealWorkstream,
  writeWorkstream,
  loadWorkstream,
} from "./load.js"
import {
  lastExpectedDocDigest,
  sha256FileBytes,
} from "./doc-digest.js"

const CLI = fileURLToPath(new URL("../../dist/cli/main.js", import.meta.url))

function repo(specBody = "# bet v1\n"): string {
  const dir = mkdtempSync(join(tmpdir(), "spec-doc-break-"))
  spawnSync("git", ["init", "-q"], { cwd: dir })
  initLedger(dir, "doc-break")
  mkdirSync(join(dir, "docs/workstreams"), { recursive: true })
  writeFileSync(join(dir, "docs/workstreams/bet.md"), specBody, "utf8")
  writeWorkstream(dir, {
    schemaVersion: 1,
    id: "W-100",
    status: "shaped",
    createdAt: new Date().toISOString(),
    featureIds: ["cli"],
    title: "Bet",
    problem: "p",
    objective: "o",
    specPath: "docs/workstreams/bet.md",
    acceptanceCriteria: ["a"],
    suggestedSlices: [],
  })
  return dir
}

describe("sl-dev-break sealed plan digests (T-021 / SLC-05)", () => {
  it("missing specPath file refuses seal", () => {
    const dir = repo()
    unlinkSync(join(dir, "docs/workstreams/bet.md"))
    assert.throws(
      () => sealWorkstream(dir, "W-100", "human"),
      /specPath|missing/i,
    )
    assert.equal(loadWorkstream(dir, "W-100").seal, undefined)
  })

  it("seal stamps digest on live seal AND snapshot; amend never mutates seal.specDocDigest", () => {
    const dir = repo()
    const sealed = sealWorkstream(dir, "W-100", "human")
    const stamped = sealed.seal!.specDocDigest!
    assert.equal(stamped, sha256FileBytes(join(dir, "docs/workstreams/bet.md")))

    const snap = JSON.parse(
      readFileSync(join(dir, ".spec-ledger", sealed.seal!.snapshotPath), "utf8"),
    )
    assert.equal(snap.specDocDigest, stamped)

    writeFileSync(join(dir, "docs/workstreams/bet.md"), "# bet v2\n", "utf8")
    const { workstream, amend } = amendWorkstream(dir, "W-100", {
      by: "human",
      summary: "v2",
    })
    assert.equal(workstream.seal!.specDocDigest, stamped)
    assert.notEqual(amend.afterDocDigest, stamped)
    assert.equal(lastExpectedDocDigest(workstream), amend.afterDocDigest)
  })

  it("latest amend.afterDocDigest wins over seal.specDocDigest and prior amends", () => {
    const dir = repo()
    sealWorkstream(dir, "W-100", "human")
    writeFileSync(join(dir, "docs/workstreams/bet.md"), "# bet v2\n", "utf8")
    const a1 = amendWorkstream(dir, "W-100", { by: "human", summary: "v2" })
    writeFileSync(join(dir, "docs/workstreams/bet.md"), "# bet v3\n", "utf8")
    const a2 = amendWorkstream(dir, "W-100", { by: "human", summary: "v3" })
    assert.notEqual(a1.amend.afterDocDigest, a2.amend.afterDocDigest)
    assert.equal(
      lastExpectedDocDigest(a2.workstream),
      a2.amend.afterDocDigest,
    )
    assert.equal(checkSeal(dir, "W-100").ok, true)

    // Silent edit after second amend must drift against v3, not seal or v2
    writeFileSync(join(dir, "docs/workstreams/bet.md"), "# bet v2\n", "utf8")
    const drifted = checkSeal(dir, "W-100")
    assert.equal(drifted.ok, false)
    assert.equal(drifted.doc?.status, "drift")
    assert.equal(drifted.doc?.expected, a2.amend.afterDocDigest)
  })

  it("backfill does not mutate prior seals/N.json bytes", () => {
    const dir = repo()
    const sealed = sealWorkstream(dir, "W-100", "human")
    // Strip digests to force upgrade path
    const live = loadWorkstream(dir, "W-100")
    const { specDocDigest: _d, ...rest } = live.seal!
    live.seal = rest
    writeWorkstream(dir, live)
    const oldSnapRel = sealed.seal!.snapshotPath
    const oldSnapAbs = join(dir, ".spec-ledger", oldSnapRel)
    const snap = JSON.parse(readFileSync(oldSnapAbs, "utf8"))
    delete snap.specDocDigest
    writeFileSync(oldSnapAbs, JSON.stringify(snap, null, 2) + "\n")
    const before = readFileSync(oldSnapAbs)

    backfillDocDigest(dir, "W-100", "human")
    assert.deepEqual(readFileSync(oldSnapAbs), before)
    assert.ok(
      existsSync(
        join(
          dir,
          ".spec-ledger",
          "workstreams",
          "W-100.seals",
          `${sealed.seal!.revision + 1}.json`,
        ),
      ),
    )
  })

  it("audit seal-digest-drift: live≠snapshot body even if seal.specDigest forged to match live", () => {
    const dir = repo()
    sealWorkstream(dir, "W-100", "human")
    const live = loadWorkstream(dir, "W-100")
    live.title = "forged without reseal"
    // Attacker also rewrites seal.specDigest to the new live hash so a
    // live↔seal.specDigest-only check would go green while snapshot body drifts.
    live.seal = {
      ...live.seal!,
      specDigest: computeSpecDigest(live),
    }
    writeWorkstream(dir, live)

    assert.equal(
      checkSeal(dir, "W-100").ok,
      false,
      "check-seal must still fail (snapshot.specDigest stale)",
    )
    const findings = auditLedger(dir).findings
    assert.ok(
      findings.some((f) => f.rule === "seal-digest-drift"),
      `audit must emit seal-digest-drift when live payload ≠ snapshot body; got ${JSON.stringify(findings.map((f) => f.rule))}`,
    )
  })

  it("deleted spec file after seal fails check-seal and audit", () => {
    const dir = repo()
    sealWorkstream(dir, "W-100", "human")
    unlinkSync(join(dir, "docs/workstreams/bet.md"))
    const r = checkSeal(dir, "W-100")
    assert.equal(r.ok, false)
    assert.ok(
      r.doc?.status === "missing-file" || r.doc?.status === "drift",
      `want missing-file/drift, got ${r.doc?.status}`,
    )
    assert.ok(
      auditLedger(dir).findings.some(
        (f) =>
          f.rule === "spec-doc-digest-drift" ||
          f.rule === "spec-doc-digest-missing",
      ),
    )
  })

  it("CLI amend + check-seal round-trip (integration)", () => {
    const dir = repo()
    const seal = spawnSync(
      process.execPath,
      [CLI, "workstream", "seal", "W-100", "--by", "human"],
      { cwd: dir, encoding: "utf8" },
    )
    assert.equal(seal.status, 0, seal.stderr)

    writeFileSync(join(dir, "docs/workstreams/bet.md"), "# bet cli\n", "utf8")
    const bad = spawnSync(
      process.execPath,
      [CLI, "workstream", "check-seal", "W-100"],
      { cwd: dir, encoding: "utf8" },
    )
    assert.notEqual(bad.status, 0)

    const amend = spawnSync(
      process.execPath,
      [
        CLI,
        "workstream",
        "amend",
        "W-100",
        "--by",
        "human",
        "--summary",
        "cli edit",
      ],
      { cwd: dir, encoding: "utf8" },
    )
    assert.equal(amend.status, 0, amend.stderr + amend.stdout)
    const ok = spawnSync(
      process.execPath,
      [CLI, "workstream", "check-seal", "W-100"],
      { cwd: dir, encoding: "utf8" },
    )
    assert.equal(ok.status, 0, ok.stdout + ok.stderr)
    const ws = loadWorkstream(dir, "W-100")
    assert.equal(ws.postSealAmends?.length, 1)
  })

  // Out-of-intent #1 (correctnessCritical): poison latest afterDocDigest to erase prior amend
  it("out-of-intent: empty afterDocDigest on latest amend must not fall back past prior amend", () => {
    const dir = repo()
    const sealed = sealWorkstream(dir, "W-100", "human")
    const sealDigest = sealed.seal!.specDocDigest!
    writeFileSync(join(dir, "docs/workstreams/bet.md"), "# bet v2\n", "utf8")
    const { amend: a1 } = amendWorkstream(dir, "W-100", {
      by: "human",
      summary: "v2",
    })
    assert.equal(a1.afterDocDigest, sha256FileBytes(join(dir, "docs/workstreams/bet.md")))

    // Poison: append empty afterDocDigest, then revert file to original seal bytes.
    // If lastExpected falls through to seal.specDocDigest, check-seal goes green and
    // the real v2 amend is erased from enforcement.
    const live = loadWorkstream(dir, "W-100")
    live.postSealAmends = [
      ...(live.postSealAmends ?? []),
      {
        at: new Date().toISOString(),
        summary: "poison empty after",
        humanConfirmed: true,
        sealedRevision: sealed.seal!.revision,
        beforeDocDigest: a1.afterDocDigest,
        afterDocDigest: "",
      },
    ]
    writeWorkstream(dir, live)
    writeFileSync(join(dir, "docs/workstreams/bet.md"), "# bet v1\n", "utf8")

    const expected = lastExpectedDocDigest(loadWorkstream(dir, "W-100"))
    const check = checkSeal(dir, "W-100")
    assert.equal(
      check.ok,
      false,
      `check-seal wrongly green after empty afterDocDigest erased prior amend (expected=${expected?.slice(0, 12)} seal=${sealDigest.slice(0, 12)} priorAmend=${a1.afterDocDigest.slice(0, 12)})`,
    )
  })

  // Out-of-intent #2 (correctnessCritical budget): path traversal poison
  it("out-of-intent: hostile specPath with .. refuses seal/read", () => {
    const dir = repo()
    const live = loadWorkstream(dir, "W-100")
    live.specPath = "../outside.md"
    writeWorkstream(dir, live)
    writeFileSync(join(dir, "outside.md"), "# leak\n", "utf8")
    assert.throws(() => sealWorkstream(dir, "W-100", "human"), /unsafe specPath/)
  })
})
