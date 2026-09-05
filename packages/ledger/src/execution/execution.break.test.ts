import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { executeOperation } from "../application/operations.js"
import { OperationError } from "../application/errors.js"
import { initLedger } from "../cli/init.js"
import { sourceFingerprint } from "../evidence/fingerprint.js"
import { writeJson } from "../fs/load.js"
import { planRevision, recordAuthority } from "../permission/authority.js"
import { loadWorkstream } from "../workstream/load.js"
import { projectExecution, type ActivityEvent, type ExecutionAssociation } from "./index.js"

let sequence = 0
function requestId(label: string): string { sequence += 1; return `${label}-${String(sequence).padStart(6, "0")}` }
function git(root: string, ...args: string[]) { const result = spawnSync("git", args, { cwd: root, encoding: "utf8" }); assert.equal(result.status, 0, result.stderr) }

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "sl-execution-break-"))
  git(root, "init", "-q"); git(root, "config", "user.email", "fixture@example.test"); git(root, "config", "user.name", "Fixture")
  initLedger(root, "execution breaker")
  writeFileSync(join(root, "source.ts"), "export const behavior = true\n")
  writeJson(join(root, ".spec-ledger/workstreams/W-001.json"), {
    schemaVersion: 1, id: "W-001", status: "active", createdAt: "2026-09-05T00:00:00.000Z",
    title: "Execution activity", problem: "Activity signals are incomplete", objective: "Keep recovery readiness honest",
    featureIds: ["alpha"], policy: { requireSpecBreak: false, requireCodeBreak: false },
    suggestedSlices: [{ id: "SLC-01", title: "Activity", kind: "vertical", acceptance: ["Activity remains bounded"] }],
  })
  writeJson(join(root, ".spec-ledger/turns/T-001.json"), {
    schemaVersion: 1, id: "T-001", status: "open", openedAt: "2026-09-05T00:00:00.000Z",
    opened: { producedBy: "fixture", baseCommit: null, dirtyAtOpen: [] },
    intent: { userPrompt: "Observe this task", restatedGoal: "Observe activity", workstreamId: "W-001", sliceId: "SLC-01", featureIds: ["alpha"] },
  })
  git(root, "add", "."); git(root, "commit", "-qm", "fixture")
  recordAuthority(root, { id: "AUTH-execution-breaker", action: "grant", mode: "request", workstreamId: "W-001", featureIds: ["alpha"], source: { kind: "agent-reported", reference: "fixture authorization" } })
  return root
}

function source(root: string): string { const value = sourceFingerprint(root); assert.ok(value); return value }
function revision(root: string): string { return planRevision(root, loadWorkstream(root, "W-001")) }
function register(root: string, session = "session-1"): ExecutionAssociation {
  return executeOperation(root, "register_execution", { requestId: requestId("register-execution"), workstreamId: "W-001", turnId: "T-001", hostSessionRef: session, expectedRevisionDigest: revision(root), expectedSourceDigest: source(root) }) as ExecutionAssociation
}
function event(root: string, registrationId: string, value: ActivityEvent) { return executeOperation(root, "record_activity", { registrationId, event: value }) }
function activity(registrationId: string, n: number, kind: ActivityEvent["kind"], extra: Partial<ActivityEvent> = {}): ActivityEvent {
  return { eventId: `${registrationId.replace("/", "-")}-${kind}-${n}`, sessionId: "session-1", sequence: n, kind, observedAt: new Date(1_800_000_000_000 + n * 1000).toISOString(), ...extra }
}
function errorFrom(fn: () => unknown): OperationError { try { fn() } catch (error) { assert.ok(error instanceof OperationError, String(error)); return error } assert.fail("operation unexpectedly succeeded") }
function projection(root: string) { return projectExecution(root, "W-001", { eligible: false, reasons: ["Current behavioral evidence is missing."] }) }

function waitFor(child: ReturnType<typeof spawn>): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = ""
    child.stdout?.on("data", chunk => { output += chunk })
    child.stderr?.on("data", chunk => { output += chunk })
    child.on("error", reject)
    child.on("close", code => code === 0 ? resolve(output) : reject(new Error(output || `activity child exited ${code}`)))
  })
}

describe("execution activity adversarial contracts", () => {
  it("does not let a delayed finish close a newer start for the same invocation", () => {
    const root = fixture()
    try {
      const registration = register(root)
      event(root, registration.registrationId, activity(registration.registrationId, 0, "session-start"))
      event(root, registration.registrationId, activity(registration.registrationId, 10, "tool-start", { invocationId: "inv-new", toolName: "check" }))
      event(root, registration.registrationId, activity(registration.registrationId, 20, "tool-start", { invocationId: "inv-new", toolName: "check" }))
      event(root, registration.registrationId, activity(registration.registrationId, 15, "tool-finish", { invocationId: "inv-new" }))
      assert.ok(projection(root).inflightInvocations.some(item => item.invocationId === "inv-new"))

    } finally { rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }) }
  })

  it("preserves a waiting report after its event falls out of the retained activity window", () => {
    const root = fixture()
    try {
      const registration = register(root)
      event(root, registration.registrationId, activity(registration.registrationId, 0, "session-start"))
      event(root, registration.registrationId, activity(registration.registrationId, 1, "waiting-user", { reason: "User approval is required" }))
      for (let n = 2; n < 400; n += 1) event(root, registration.registrationId, activity(registration.registrationId, n, "session-start"))
      const observed = projection(root)
      assert.equal(observed.waiting.active, true)
      assert.ok(observed.continuation.reasons.includes("waiting-for-user"))
    } finally { rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }) }
  })

  it("does not let a delayed start resurrect an invocation already finished at a newer sequence", () => {
    const root = fixture()
    try {
      const registration = register(root)
      event(root, registration.registrationId, activity(registration.registrationId, 0, "session-start"))
      event(root, registration.registrationId, activity(registration.registrationId, 30, "tool-start", { invocationId: "inv-done" }))
      event(root, registration.registrationId, activity(registration.registrationId, 40, "tool-finish", { invocationId: "inv-done" }))
      event(root, registration.registrationId, activity(registration.registrationId, 35, "tool-start", { invocationId: "inv-done" }))
      assert.ok(!projection(root).inflightInvocations.some(item => item.invocationId === "inv-done"))
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  it("uses sequence rather than caller timestamps to leave a reported waiting state", () => {
    const root = fixture()
    try {
      const registration = register(root)
      event(root, registration.registrationId, activity(registration.registrationId, 0, "session-start"))
      event(root, registration.registrationId, activity(registration.registrationId, 50, "waiting-user", { observedAt: "2099-01-01T00:00:00.000Z", reason: "Approval needed" }))
      event(root, registration.registrationId, activity(registration.registrationId, 51, "resumed", { observedAt: "2020-01-01T00:00:00.000Z" }))
      assert.equal(projection(root).waiting.active, false)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  it("bounds retained invocation state as well as event history and surfaces overflow as uncertainty", () => {
    const root = fixture()
    try {
      const registration = register(root)
      for (let n = 0; n < 600; n += 1) event(root, registration.registrationId, activity(registration.registrationId, n, "tool-start", { invocationId: `inv-${n}`, toolName: "bounded-tool" }))
      const runtimePath = join(root, ".spec-ledger/runtime/activity/W-001--X-001.json")
      assert.ok(statSync(runtimePath).size <= 64 * 1024)
      const observed = projection(root)
      assert.ok(observed.inflightInvocations.length <= 256)
      assert.ok(observed.signals.dropped > 0)
      assert.ok(observed.continuation.reasons.includes("activity-uncertain"))
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  it("does not corrupt accepted activity and reports rejected delivery when local callers overlap", async () => {
    const root = fixture()
    try {
      const registration = register(root)
      const barrier = join(root, "release-activity-children")
      const moduleUrl = new URL("./index.js", import.meta.url).href
      const script = `
        import { existsSync } from 'node:fs';
        const { recordActivity } = await import(process.argv[1]);
        const [root, registrationId, barrier, workerText] = process.argv.slice(2);
        const worker = Number(workerText);
        while (!existsSync(barrier)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2);
        let accepted = 0;
        let rejected = 0;
        for (let offset = 0; offset < 8; offset += 1) {
          const sequence = worker * 8 + offset;
          const result = recordActivity(root, registrationId, { eventId: 'parallel-' + worker + '-' + offset, sessionId: 'session-1', sequence, kind: 'session-start', observedAt: new Date(1800000000000 + sequence * 1000).toISOString() });
          if (result.accepted) accepted += 1; else rejected += 1;
        }
        console.log(JSON.stringify({ accepted, rejected }));
      `
      const children = Array.from({ length: 16 }, (_, worker) => spawn(process.execPath, ["--input-type=module", "-e", script, moduleUrl, root, registration.registrationId, barrier, String(worker)], { stdio: ["ignore", "pipe", "pipe"] }))
      writeFileSync(barrier, "go")
      const reports = (await Promise.all(children.map(waitFor))).map(output => JSON.parse(output) as { accepted: number; rejected: number })
      const accepted = reports.reduce((sum, report) => sum + report.accepted, 0)
      const rejected = reports.reduce((sum, report) => sum + report.rejected, 0)
      const observed = projection(root)
      assert.equal(accepted + rejected, 128)
      assert.equal(observed.signals.totalSeen, accepted)
      if (rejected > 0) {
        assert.ok(observed.signals.dropped > 0)
        assert.ok(observed.continuation.reasons.includes("activity-uncertain"))
      }
    } finally { rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }) }
  })

  it("reads the requested registration exactly and keeps a stop sticky across later activity and registrations", () => {
    const root = fixture()
    try {
      const first = register(root, "session-1")
      executeOperation(root, "stop_execution", { requestId: requestId("stop-execution"), registrationId: first.registrationId, reason: "User stopped this execution", source: { kind: "agent-reported", reference: "fixture stop" }, expectedRevisionDigest: revision(root), expectedSourceDigest: source(root) })
      event(root, first.registrationId, activity(first.registrationId, 1, "resumed"))
      const second = register(root, "session-2")
      const requested = executeOperation(root, "get_execution", { registrationId: first.registrationId }) as ReturnType<typeof projection>
      assert.equal(requested.association?.registrationId, first.registrationId)
      assert.notEqual(requested.association?.registrationId, second.registrationId)
      assert.equal(requested.stop.stopped, true)
      assert.equal(requested.state, "stopped")
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  it("rejects forged sessions and private payload fields without changing source or evidence", () => {
    const root = fixture()
    try {
      const before = source(root)
      const registration = register(root)
      const forged = errorFrom(() => event(root, registration.registrationId, activity(registration.registrationId, 1, "session-start", { sessionId: "forged-session" })))
      assert.equal(forged.code, "invalid_input")
      const privatePayload = errorFrom(() => executeOperation(root, "record_activity", { registrationId: registration.registrationId, event: { ...activity(registration.registrationId, 2, "tool-start", { invocationId: "private" }), arguments: { token: "secret" }, output: "private" } }))
      assert.equal(privatePayload.code, "invalid_input")
      event(root, registration.registrationId, activity(registration.registrationId, 3, "session-start"))
      assert.equal(source(root), before)
      assert.equal(existsSync(join(root, ".spec-ledger/results/last.json")), false)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  it("confines both durable execution and transient activity storage against escaping symlinks", () => {
    const outsideDurable = mkdtempSync(join(tmpdir(), "sl-execution-durable-outside-"))
    const durableRoot = fixture()
    try {
      symlinkSync(outsideDurable, join(durableRoot, ".spec-ledger/executions"), "dir")
      errorFrom(() => register(durableRoot))
      assert.deepEqual(readdirSync(outsideDurable), [])
    } finally { rmSync(durableRoot, { recursive: true, force: true }); rmSync(outsideDurable, { recursive: true, force: true }) }

    const outsideRuntime = mkdtempSync(join(tmpdir(), "sl-execution-runtime-outside-"))
    const runtimeRoot = fixture()
    try {
      const registration = register(runtimeRoot)
      mkdirSync(join(runtimeRoot, ".spec-ledger/runtime"), { recursive: true })
      symlinkSync(outsideRuntime, join(runtimeRoot, ".spec-ledger/runtime/activity"), "dir")
      errorFrom(() => event(runtimeRoot, registration.registrationId, activity(registration.registrationId, 1, "session-start")))
      assert.deepEqual(readdirSync(outsideRuntime), [])
    } finally { rmSync(runtimeRoot, { recursive: true, force: true }); rmSync(outsideRuntime, { recursive: true, force: true }) }
  })

  it("records from a linked worktree and installs the activity ignore in shared git metadata", () => {
    const main = fixture()
    const worktreeParent = mkdtempSync(join(tmpdir(), "sl-execution-linked-"))
    const linked = join(worktreeParent, "checkout")
    try {
      git(main, "worktree", "add", "-q", "-b", `execution-linked-${process.pid}-${Date.now()}`, linked, "HEAD")
      recordAuthority(linked, { id: "AUTH-execution-linked", action: "grant", mode: "request", workstreamId: "W-001", featureIds: ["alpha"], source: { kind: "agent-reported", reference: "linked worktree fixture authorization" } })
      const registration = register(linked)
      event(linked, registration.registrationId, activity(registration.registrationId, 1, "session-start"))
      assert.equal(projection(linked).signals.totalSeen, 1)
      const commonGitDir = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: linked, encoding: "utf8" })
      assert.equal(commonGitDir.status, 0, commonGitDir.stderr)
      assert.match(readFileSync(join(commonGitDir.stdout.trim(), "info/exclude"), "utf8"), /^\.spec-ledger\/runtime\/activity\/$/m)
    } finally {
      spawnSync("git", ["worktree", "remove", "--force", linked], { cwd: main, encoding: "utf8" })
      rmSync(worktreeParent, { recursive: true, force: true })
      rmSync(main, { recursive: true, force: true })
    }
  })

  it("never turns agent-requested continuation or timeout settings into verified host capability", () => {
    const root = fixture()
    try {
      const registration = register(root)
      executeOperation(root, "configure_execution", {
        requestId: requestId("configure-execution"), registrationId: registration.registrationId,
        continuation: { requested: true, retryLimit: 0, expiresAt: "2000-01-01T00:00:00.000Z" }, timeout: { warningAfterMs: 1000, enforceAfterMs: 2000 },
        source: { kind: "agent-reported", reference: "Caller requests controls" }, expectedRevisionDigest: revision(root), expectedSourceDigest: source(root),
      })
      const observed = projection(root)
      assert.equal(observed.continuation.effective, false)
      assert.equal(observed.continuation.userOptInVerified, false)
      assert.equal(observed.continuation.remainingRetries, 0)
      assert.ok(observed.continuation.reasons.includes("retry-exhausted"))
      assert.ok(observed.continuation.reasons.includes("expired"))
      assert.ok(observed.continuation.reasons.includes("host-resume-unsupported"))
      assert.deepEqual(observed.hostCapabilities, { verified: false, liveness: false, resume: false, cancelTool: false, ownedProcess: false })
      assert.equal(observed.timeout.enforcement, "unsupported")
      assert.match(observed.continuation.prompt ?? "", /Task T-001 in W-001: Execution activity\./)
      assert.match(observed.continuation.prompt ?? "", /current revision [a-f0-9]{64}/)
      assert.match(observed.continuation.prompt ?? "", /Remaining: Current behavioral evidence is missing\./)
      assert.match(observed.continuation.prompt ?? "", /No agent was resumed and no host action was dispatched\./)

      recordAuthority(root, { id: "AUTH-execution-revoked", action: "revoke", targetId: "AUTH-execution-breaker", workstreamId: "W-001", source: { kind: "agent-reported", reference: "User revoked execution permission" } })
      const revoked = projection(root)
      assert.ok(revoked.continuation.reasons.includes("permission-revoked"))
      assert.equal(revoked.continuation.readiness, "blocked")
      assert.match(revoked.continuation.prompt ?? "", /Pause execution:/)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  it("keeps collector failure and invalid emitter buffers from crashing the host process", () => {
    const emitterModule = new URL("./emitter.js", import.meta.url).href
    const missingRoot = join(tmpdir(), `sl-missing-ledger-${process.pid}-${Date.now()}`)
    const crashScript = `
      const { createActivityEmitter } = await import(process.argv[1]);
      const emitter = createActivityEmitter({ root: process.argv[2] });
      await new Promise(resolve => setTimeout(resolve, 150));
      const accepted = emitter.emit('W-001/X-001', { eventId:'after-exit', sessionId:'session-1', sequence:1, kind:'session-start', observedAt:new Date().toISOString() });
      console.log(String(accepted));
      emitter.close();
      await new Promise(resolve => setTimeout(resolve, 50));
    `
    const crashed = spawnSync(process.execPath, ["--input-type=module", "-e", crashScript, emitterModule, missingRoot], { encoding: "utf8", timeout: 3000 })
    assert.equal(crashed.status, 0, crashed.stderr || crashed.stdout)
    assert.equal(crashed.stdout.trim(), "false")

    const root = fixture()
    try {
      const boundScript = `
        const { createActivityEmitter } = await import(process.argv[1]);
        try { createActivityEmitter({ root: process.argv[2], maxBufferedBytes: Infinity }); console.log('accepted'); }
        catch { console.log('rejected'); }
      `
      const bounded = spawnSync(process.execPath, ["--input-type=module", "-e", boundScript, emitterModule, root], { encoding: "utf8", timeout: 3000 })
      assert.equal(bounded.status, 0, bounded.stderr || bounded.stdout)
      assert.equal(bounded.stdout.trim(), "rejected")
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})
