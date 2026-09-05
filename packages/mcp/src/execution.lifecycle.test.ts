import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { initLedger, loadWorkstream, planRevision, sourceFingerprint } from '@nessalabs/spec-ledger'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const cliBin = join(here, '../../ledger/dist/cli/main.js')
type Envelope = { ok: boolean; result?: any; error?: { code: string; message: string } }
type Caller = (operation: string, input: Record<string, unknown>) => Promise<Envelope>

function run(root: string, command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout
}

function fixture(label: string) {
  const root = mkdtempSync(join(tmpdir(), `sl-execution-${label}-`))
  run(root, 'git', ['init', '-q'])
  run(root, 'git', ['config', 'user.email', 'fixture@example.test'])
  run(root, 'git', ['config', 'user.name', 'Fixture'])
  initLedger(root, 'Execution fixture')
  mkdirSync(join(root, 'skills'), { recursive: true })
  writeFileSync(join(root, 'skills/team.md'), '# Team method\nExplain the claim, exercise the behavior, and retain the evidence.\n')
  writeFileSync(join(root, 'behavior.cjs'), 'module.exports = { greeting: name => `Hello ${name}` }\n')
  writeFileSync(join(root, 'check.cjs'), 'const assert = require("node:assert/strict"); assert.equal(require("./behavior.cjs").greeting("Ada"), "Hello Ada");\n')
  writeFileSync(join(root, '.spec-ledger/claims/SL-001.json'), JSON.stringify({ id: 'SL-001', statement: 'Greeting includes the supplied name', required: true }))
  writeFileSync(join(root, '.spec-ledger/bindings/greeting.json'), JSON.stringify({ id: 'greeting', claimId: 'SL-001', kind: 'test', locator: { type: 'command', command: `${process.execPath} check.cjs` } }))
  writeFileSync(join(root, '.spec-ledger/workstreams/W-001.json'), JSON.stringify({
    schemaVersion: 1, id: 'W-001', status: 'shaped', title: 'Team greeting', objective: 'Greet the supplied name', featureIds: ['alpha'],
    acceptanceCriteria: ['Greeting includes the supplied name'], acceptanceClaimIds: { 'AC-1': ['SL-001'] },
    policy: { requireSpecBreak: true, requireCodeBreak: true, requireAlignApprove: true }, trust: {},
    suggestedSlices: [{ id: 'SLC-01', title: 'Greeting', kind: 'vertical', acceptance: ['Greeting works'], expectedPaths: ['**'] }],
  }))
  run(root, 'git', ['add', '.'])
  run(root, 'git', ['commit', '-qm', 'fixture'])
  return root
}

async function adapter(root: string, surface: 'cli' | 'mcp'): Promise<{ call: Caller; close: () => Promise<void> }> {
  if (surface === 'cli') {
    const inputs = mkdtempSync(join(tmpdir(), 'sl-execution-input-'))
    let sequence = 0
    return {
      call: async (operation, input) => {
        const path = join(inputs, `${++sequence}.json`)
        writeFileSync(path, JSON.stringify(input))
        const result = spawnSync(process.execPath, [cliBin, 'operation', operation, '--file', path, '--root', root], { encoding: 'utf8' })
        const envelope = JSON.parse(result.stdout) as Envelope
        assert.equal(result.status, envelope.ok ? 0 : 1, result.stderr)
        return envelope
      },
      close: async () => { rmSync(inputs, { recursive: true, force: true }) },
    }
  }
  const client = new Client({ name: 'custom-workflow-test', version: '1' })
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(here, 'main.js'), '--root', root], stderr: 'pipe' }))
  return { call: async (name, input) => (await client.callTool({ name, arguments: input })).structuredContent as unknown as Envelope, close: () => client.close() }
}

function domain(root: string) {
  const result: Record<string, string> = {}
  function visit(path: string, relative: string) {
    for (const name of readdirSync(path).sort()) {
      const rel = relative ? `${relative}/${name}` : name
      if (rel === '.git' || rel === '.spec-ledger/operations') continue
      const child = join(path, name)
      if (statSync(child).isDirectory()) visit(child, rel)
      else result[rel] = readFileSync(child, 'utf8')
    }
  }
  visit(root, '')
  return result
}


async function preparedExecution(root: string, call: Caller, surface: string) {
  let sequence = 0
  const request = () => `execution-${surface}-request-${String(++sequence).padStart(4, '0')}`
  const current = () => ({ expectedRevisionDigest: planRevision(root, loadWorkstream(root, 'W-001')), expectedSourceDigest: sourceFingerprint(root)! })
  const invoke = async (operation: string, input: Record<string, unknown>) => {
    const envelope = await call(operation, input)
    assert.equal(envelope.ok, true, `${operation}: ${JSON.stringify(envelope)}`)
    return envelope.result
  }
  await invoke('record_permission', { requestId: request(), authority: { id: 'AUTH-execution', action: 'grant', mode: 'request', workstreamId: 'W-001', featureIds: ['alpha'], source: { kind: 'agent-reported', reference: 'Owned integration fixture request' } } })
  await invoke('record_review', { requestId: request(), target: 'spec', workstreamId: 'W-001', expectedRevisionDigest: current().expectedRevisionDigest, review: { kind: 'adversarial', reviewer: 'fixture-reviewer', verdict: 'approve', summary: 'The fixture is bounded.', plainSummary: 'The fixture is ready to build.' } })
  await invoke('begin_work', { requestId: request(), workstreamId: 'W-001', sliceId: 'SLC-01', goal: 'Track the owned fixture session', allowDirty: true, expectedRevisionDigest: current().expectedRevisionDigest })
  await invoke('run_checks', { requestId: request(), expectedSourceDigest: current().expectedSourceDigest })
  const registration = await invoke('register_execution', { requestId: request(), workstreamId: 'W-001', turnId: 'T-001', hostSessionRef: `fixture:${surface}`, ...current() })
  return { invoke, request, current, registration }
}

for (const surface of ['cli', 'mcp'] as const) {
  it(`${surface}: activity preserves evidence and cannot grant recovery authority`, async () => {
    const root = fixture(surface)
    const transport = await adapter(root, surface)
    try {
      const { invoke, request, current, registration } = await preparedExecution(root, transport.call, surface)
      const registrationId = registration.registrationId
      const initialSource = current().expectedSourceDigest
      const receipts = () => readdirSync(join(root, '.spec-ledger/operations')).sort()
      const beforeEvents = receipts()
      const observedAt = new Date(Date.now() - 5000).toISOString()
      const event = (eventId: string, sequence: number, kind: string, more: Record<string, unknown> = {}) => ({ eventId, sessionId: registration.hostSessionRef, sequence, kind, observedAt, ...more })
      const signal = (value: Record<string, unknown>) => invoke('record_activity', { registrationId, event: value })
      await signal(event('start', 0, 'session-start'))
      const toolStart = event('tool-start', 1, 'tool-start', { invocationId: 'tool-1', toolName: 'behavioral-check' })
      await signal(toolStart)
      await signal(toolStart)
      const running = await invoke('get_execution', { registrationId })
      assert.equal(running.inflightInvocations.length, 1)
      assert.equal(running.inflightInvocations[0].invocationId, 'tool-1')
      assert.equal(running.signals.duplicateCount, 1)
      assert.equal(running.continuation.effective, false)
      assert.equal(running.hostCapabilities.resume, false)
      assert.deepEqual(receipts(), beforeEvents, 'Transient signals and observations must not accumulate durable operation receipts')
      assert.equal(current().expectedSourceDigest, initialSource)
      const unchanged = (await invoke('get_session', { workstreamId: 'W-001' })).session
      assert.equal(unchanged.criteria[0].evidence, 'pass', 'Activity does not stale source evidence')
      assert.equal(unchanged.completion.eligible, false, 'Activity does not complete the work')

      const beforeSpoof = domain(root)
      const spoof = await transport.call('record_activity', { registrationId, event: event('spoof', 2, 'tool-finish', { sessionId: 'other-host', invocationId: 'tool-1' }) })
      assert.equal(spoof.ok, false)
      assert.deepEqual(domain(root), beforeSpoof)
      const forged = await transport.call('record_activity', { registrationId, event: { ...event('forged-capability', 2, 'session-start'), capabilities: { resume: true }, toolArguments: 'must not be retained' } })
      assert.equal(forged.ok, false)
      assert.deepEqual(domain(root), beforeSpoof)

      await invoke('configure_execution', { requestId: request(), registrationId, ...current(), continuation: { requested: true, minIntervalMs: 60000, retryLimit: 2, expiresAt: new Date(Date.now() + 600000).toISOString() }, timeout: { warningAfterMs: 1000, enforceAfterMs: 2000 }, source: { kind: 'agent-reported', reference: 'Fixture requests policy; it does not authenticate user opt-in' } })
      const policy = await invoke('get_execution', { registrationId })
      assert.equal(policy.continuation.requested, true)
      assert.equal(policy.continuation.effective, false)
      assert.equal(policy.continuation.userOptInVerified, false)
      assert.ok(policy.continuation.reasons.includes('host-resume-unsupported'))
      assert.ok(policy.continuation.reasons.includes('inflight-invocation'))
      assert.equal(policy.timeout.enforcement, 'unsupported')
      assert.equal(policy.timeout.warnings[0].invocationId, 'tool-1')
      await signal(event('waiting', 2, 'waiting-user', { reason: 'The user must answer a scope question' }))
      assert.equal((await invoke('get_execution', { registrationId })).waiting.active, true)
      await invoke('stop_execution', { requestId: request(), registrationId, ...current(), reason: 'Explicitly stop the fixture session', source: { kind: 'agent-reported', reference: 'Fixture stop instruction' } })
      await signal(event('resumed', 3, 'resumed'))
      const stopped = await invoke('get_execution', { registrationId })
      assert.equal(stopped.stop.stopped, true)
      assert.equal(stopped.state, 'stopped')
      assert.equal(stopped.continuation.effective, false)
      assert.ok(stopped.continuation.reasons.includes('explicitly-stopped'))
      assert.equal(stopped.inflightInvocations.length, 1, 'A resume report cannot finish an unfinished tool')
      await invoke('record_permission', { requestId: request(), authority: { id: 'AUTH-execution-revoke', action: 'revoke', targetId: 'AUTH-execution', source: { kind: 'agent-reported', reference: 'Fixture revocation' } } })
      const revoked = await invoke('get_execution', { registrationId })
      assert.ok(revoked.continuation.reasons.includes('permission-revoked'))
      assert.equal(revoked.continuation.effective, false)
      assert.equal(current().expectedSourceDigest, initialSource)
    } finally {
      await transport.close()
      rmSync(root, { recursive: true, force: true })
    }
  })
}

it('persistent activity collector recovers after oversized framing and records later signals', async () => {
  const root = fixture('collector')
  const transport = await adapter(root, 'mcp')
  try {
    const { invoke, registration } = await preparedExecution(root, transport.call, 'collector')
    const child = spawn(process.execPath, [join(here, '../../ledger/dist/cli/activity-collector.js'), '--root', root], { stdio: ['pipe', 'pipe', 'pipe'] })
    let diagnostics = ''
    child.stderr.on('data', data => { diagnostics = (diagnostics + String(data)).slice(-16000) })
    const exit = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve) })
    const frame = (sequence: number, kind: string, more: Record<string, unknown> = {}) => JSON.stringify({ registrationId: registration.registrationId, event: { eventId: `collector-${sequence}`, sessionId: registration.hostSessionRef, sequence, kind, observedAt: new Date().toISOString(), ...more } }) + '\n'
    child.stdin.write('x'.repeat(100000))
    child.stdin.write('\nnot-json\n')
    child.stdin.write(frame(0, 'session-start'))
    child.stdin.write(frame(1, 'tool-start', { invocationId: 'collector-tool', toolName: 'owned-check' }))
    child.stdin.end()
    assert.equal(await exit, 0, diagnostics)
    const observed = await invoke('get_execution', { registrationId: registration.registrationId })
    assert.equal(observed.inflightInvocations.length, 1)
    assert.equal(observed.inflightInvocations[0].invocationId, 'collector-tool')
    assert.equal(observed.signals.retained, 2)
    const runtimeFiles = readdirSync(join(root, '.spec-ledger/runtime/activity')).filter(name => name.endsWith('.json'))
    assert.equal(runtimeFiles.length, 1)
    assert.ok(statSync(join(root, '.spec-ledger/runtime/activity', runtimeFiles[0]!)).size <= 65536)
    assert.equal(run(root, 'git', ['ls-files', '--others', '--exclude-standard', '.spec-ledger/runtime/activity']).trim(), '', 'Transient activity must be git-ignored')
  } finally {
    await transport.close()
    rmSync(root, { recursive: true, force: true })
  }
})
