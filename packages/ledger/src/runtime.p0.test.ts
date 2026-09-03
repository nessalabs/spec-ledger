import assert from "node:assert/strict"
import { mkdtempSync, rmSync, cpSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import {
  nextAutomationEventId,
  resumeAutomationEvents,
  writeAutomationEvent,
} from "./automation/load.js"
import { getRelatedPack } from "./related/pack.js"
import { auditLedger } from "./audit/audit.js"
import { getCompass } from "./compass/load.js"

const REPO = join(import.meta.dirname, "../../..")

test("automation wait timeout resolves on resume", () => {
  const dir = mkdtempSync(join(tmpdir(), "sl-ae-"))
  try {
    cpSync(join(REPO, ".spec-ledger"), join(dir, ".spec-ledger"), { recursive: true })
    mkdirSync(join(dir, ".spec-ledger/automation-events"), { recursive: true })
    const id = nextAutomationEventId(dir)
    writeAutomationEvent(dir, {
      schemaVersion: 1,
      id,
      kind: "alert",
      workstreamId: "W-001",
      mode: "wait",
      policySnapshot: { onAlertTimeout: "move" },
      state: "waiting",
      alertedAt: "2020-01-01T00:00:00.000Z",
      waitUntil: "2020-01-01T00:10:00.000Z",
    })
    const { recent, open } = resumeAutomationEvents(dir, {
      workstreamId: "W-001",
      now: new Date("2020-01-01T01:00:00.000Z"),
    })
    assert.equal(recent.length, 1)
    assert.equal(recent[0]!.state, "resolved")
    assert.equal(recent[0]!.trigger, "timeout")
    assert.equal(open.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("related pack + compass + audit load for dogfood repo", () => {
  const pack = getRelatedPack(REPO, "W-001")
  assert.ok(pack.claims.length >= 1)
  assert.ok(pack.docs.length >= 1)
  const compass = getCompass(REPO)
  assert.ok(compass.vision)
  assert.ok(compass.tenets.length >= 1)
  const audit = auditLedger(REPO)
  assert.equal(typeof audit.ok, "boolean")
  assert.ok(Array.isArray(audit.findings))
})
