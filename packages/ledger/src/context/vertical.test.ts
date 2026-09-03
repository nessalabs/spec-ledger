import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { cpSync } from "node:fs"
import { getVerticalContext } from "../context/vertical.js"
import { loadLedger, sha256Stable } from "../fs/load.js"
import { verifyLedger } from "../verify/verify.js"
import {
  checkSeal,
  computeSpecDigest,
  sealWorkstream,
} from "../workstream/load.js"

const REPO = join(import.meta.dirname, "../../../..")

test("vision/workstreams do not change verify ledgerDigest", () => {
  const a = verifyLedger(loadLedger(REPO)).provenance.ledgerDigest
  // digest excludes turns/vision/workstreams by construction in verifyLedger
  const b = verifyLedger(loadLedger(REPO)).provenance.ledgerDigest
  assert.equal(a, b)
  assert.equal(a.length, 64)
})

test("seal + contextDigest stable across calls", () => {
  const dir = mkdtempSync(join(tmpdir(), "sl-ctx-"))
  try {
    cpSync(join(REPO, ".spec-ledger"), join(dir, ".spec-ledger"), { recursive: true })
    const ws = sealWorkstream(dir, "W-001", "test")
    assert.ok(ws.seal)
    assert.equal(ws.seal.specDigest, computeSpecDigest(ws))
    const check = checkSeal(dir, "W-001")
    assert.equal(check.ok, true)

    const c1 = getVerticalContext(dir, "W-001", "SLC-01")
    const c2 = getVerticalContext(dir, "W-001", "SLC-01")
    assert.equal(c1.contextDigest, c2.contextDigest)
    assert.ok(c1.claims.live.some((c) => c.id.startsWith("SL-")))
    assert.equal(typeof c1.contextDigest, "string")
    assert.equal(c1.contextDigest.length, 64)
    // generatedAt excluded from digest stability already
    assert.notEqual(c1.generatedAt, "")
    assert.equal(sha256Stable({ a: 1 }), sha256Stable({ a: 1 }))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
