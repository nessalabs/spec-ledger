import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { initLedger, loadWorkstream, planRevision, sourceFingerprint } from '@nessalabs/spec-ledger'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
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
  const root = mkdtempSync(join(tmpdir(), `sl-method-${label}-`))
  run(root, 'git', ['init', '-q'])
  run(root, 'git', ['config', 'user.email', 'fixture@example.test'])
  run(root, 'git', ['config', 'user.name', 'Fixture'])
  initLedger(root, 'Custom method fixture')
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
    const inputs = mkdtempSync(join(tmpdir(), 'sl-method-input-'))
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

const teamProfile = {
  id: 'team-greeting', title: 'Team greeting method',
  skills: { team: { path: 'skills/team.md', acknowledgeUncertain: true } },
  stages: [
    { id: 'plan', title: 'Plan', role: 'plan', steps: [{ id: 'scope', title: 'Preserve the intent', skill: 'team', outputs: [{ kind: 'spec-revision' }] }] },
    { id: 'grill', title: 'Challenge the plan', role: 'spec-review', steps: [{ id: 'review', title: 'Review the intent', skill: 'team', outputs: [{ kind: 'spec-review' }] }, { id: 'edge-cases', title: 'Describe the edge cases', skill: 'team', outputs: [{ kind: 'attestation' }] }] },
    { id: 'build', title: 'Implement', role: 'implement', steps: [{ id: 'code', title: 'Implement the greeting', skill: 'team', outputs: [{ kind: 'implementation-report', criterionIds: ['AC-1'] }] }] },
    { id: 'verify', title: 'Verify', role: 'verify', steps: [{ id: 'test', title: 'Exercise the greeting', skill: 'team', outputs: [{ kind: 'check-results', criterionIds: ['AC-1'] }] }] },
    { id: 'review', title: 'Review code', role: 'code-review', steps: [{ id: 'break', title: 'Challenge the implementation', skill: 'team', outputs: [{ kind: 'code-review' }] }] },
  ],
}

for (const surface of ['cli', 'mcp'] as const) {
  it(`${surface}: follows a custom method through real records and preserves current evidence`, async () => {
    const root = fixture(surface)
    const transport = await adapter(root, surface)
    let counter = 0
    const requestId = () => `method-${surface}-request-${String(++counter).padStart(4, '0')}`
    const current = () => ({ expectedRevisionDigest: planRevision(root, loadWorkstream(root, 'W-001')), expectedSourceDigest: sourceFingerprint(root)! })
    const invoke = async (operation: string, input: Record<string, unknown>) => {
      const envelope = await transport.call(operation, input)
      assert.equal(envelope.ok, true, `${operation}: ${JSON.stringify(envelope)}`)
      return envelope.result
    }
    try {
      await invoke('record_permission', { requestId: requestId(), authority: { id: 'AUTH-team', action: 'grant', mode: 'request', workstreamId: 'W-001', featureIds: ['alpha'], source: { kind: 'agent-reported', reference: 'Fixture user request' } } })
      await invoke('record_review', { requestId: requestId(), target: 'spec', workstreamId: 'W-001', expectedRevisionDigest: current().expectedRevisionDigest, review: { kind: 'adversarial', reviewer: 'fixture-spec-review', verdict: 'approve', summary: 'The greeting has bounded acceptance and a behavioral check.', plainSummary: 'The greeting plan is ready to build.' } })
      await invoke('begin_work', { requestId: requestId(), workstreamId: 'W-001', sliceId: 'SLC-01', goal: 'Implement the named greeting', allowDirty: true, expectedRevisionDigest: current().expectedRevisionDigest })
      const selectionInput = { requestId: requestId(), workstreamId: 'W-001', ...current(), profile: teamProfile }
      const selected = await invoke('set_workflow', selectionInput)
      assert.match(selected.snapshotDigest, /^[a-f0-9]{64}$/)
      const selectedDomain = domain(root)
      assert.deepEqual(await invoke('set_workflow', selectionInput), selected)
      assert.deepEqual(domain(root), selectedDomain)
      const methodInput = () => ({ workstreamId: 'W-001', ...current(), expectedSnapshotDigest: selected.snapshotDigest })
      const begin = (stageId: string, stepId: string) => invoke('begin_workflow_step', { requestId: requestId(), ...methodInput(), stageId, stepId })
      const output = (attemptId: string, kind: string, recordType: string, recordIds: string[], criterionIds?: string[]) => invoke('record_workflow_output', { requestId: requestId(), ...methodInput(), attemptId, kind, recordType, recordIds, ...(criterionIds ? { criterionIds } : {}) })

      const beforeSkip = domain(root)
      const skip = await transport.call('begin_workflow_step', { requestId: requestId(), ...methodInput(), stageId: 'build', stepId: 'code' })
      assert.equal(skip.ok, false, 'Custom grilling prerequisites must prevent early implementation step')
      assert.deepEqual(domain(root), beforeSkip)

      const plan = await begin('plan', 'scope')
      await output(plan.id, 'spec-revision', 'snapshot', [loadWorkstream(root, 'W-001').seal!.snapshotPath!])
      const grill = await begin('grill', 'review')
      const specReview = await invoke('record_review', { requestId: requestId(), target: 'spec', workstreamId: 'W-001', expectedRevisionDigest: current().expectedRevisionDigest, review: { kind: 'adversarial', reviewer: 'fixture-method-review', verdict: 'approve', summary: 'Reviewed the greeting plan under the selected team method.', plainSummary: 'The team method confirms the plan is ready.' } })
      await output(grill.id, 'spec-review', 'review', [specReview.id])
      const edgeCases = await begin('grill', 'edge-cases')
      const attestation = await invoke('record_decision', { requestId: requestId(), turnId: 'T-001', ...current(), decision: 'Preserve the supplied name, including an empty name.', rationale: 'This is a reported edge-case assessment, not passing test evidence.' })
      await output(edgeCases.id, 'attestation', 'decision', [attestation.id])
      const implementation = await begin('build', 'code')
      const progress = await invoke('record_progress', { requestId: requestId(), turnId: 'T-001', ...current(), summary: 'The greeting includes the supplied name.', criterionIds: ['AC-1'], implemented: true })
      await output(implementation.id, 'implementation-report', 'decision', [progress.id], ['AC-1'])
      const checks = await begin('verify', 'test')
      await invoke('run_checks', { requestId: requestId(), expectedSourceDigest: current().expectedSourceDigest })
      await output(checks.id, 'check-results', 'result', ['command:greeting'], ['AC-1'])
      const codeReview = await begin('review', 'break')
      const review = await invoke('record_review', { requestId: requestId(), target: 'code', turnId: 'T-001', expectedSourceDigest: current().expectedSourceDigest, review: { kind: 'adversarial', reviewer: 'fixture-code-review', verdict: 'approve', summary: 'The named greeting passed the independent behavioral fixture.', plainSummary: 'The greeting implementation is ready.', killersCited: ['check.cjs checks exact output for Ada'] } })
      await output(codeReview.id, 'code-review', 'review', [review.id])
      await invoke('approve_alignment', { requestId: requestId(), turnId: 'T-001', expectedSourceDigest: current().expectedSourceDigest, reviewer: 'agent:align:fixture', summary: 'All product paths are within the fixture plan.', plainSummary: 'Changed files match the plan.' })

      const observedDomain = domain(root)
      const workflow = await invoke('get_workflow', { workstreamId: 'W-001' })
      const session = (await invoke('get_session', { workstreamId: 'W-001' })).session
      assert.deepEqual(domain(root), observedDomain, 'Workflow/session reads must be passive')
      assert.equal(session.criteria[0].evidence, 'pass')
      assert.ok(session.workflow, 'The same method must be visible in the session projection')
      assert.ok(JSON.stringify(workflow).includes('Team greeting method'))
      assert.ok(JSON.stringify(workflow).includes('Describe the edge cases'))
      assert.ok(JSON.stringify(workflow).includes('attested'), 'Attestation provenance must stay visible')
      assert.ok(JSON.stringify(workflow).includes('Explain the claim'), 'Preserved local skill guidance must be inspectable')

      // A source change invalidates prior reports and proof without any output rewrite.
      writeFileSync(join(root, 'behavior.cjs'), 'module.exports = { greeting: name => `Hi ${name}` }\n')
      const changed = (await invoke('get_session', { workstreamId: 'W-001' })).session
      assert.notEqual(changed.criteria[0].evidence, 'pass')
      assert.equal(changed.completion.eligible, false)
      const staleBefore = domain(root)
      const stale = await transport.call('record_workflow_output', { requestId: requestId(), ...methodInput(), expectedSourceDigest: selectionInput.expectedSourceDigest, attemptId: checks.id, kind: 'check-results', recordType: 'result', recordIds: ['command:greeting'], criterionIds: ['AC-1'] })
      assert.equal(stale.ok, false)
      assert.deepEqual(domain(root), staleBefore)

      // Restore identical content: existing evidence remains tied to content, not commit identity.
      writeFileSync(join(root, 'behavior.cjs'), 'module.exports = { greeting: name => `Hello ${name}` }\n')
      await invoke('finish_turn', { requestId: requestId(), turnId: 'T-001', action: 'close', expectedSourceDigest: current().expectedSourceDigest })
      await invoke('complete_work', { requestId: requestId(), workstreamId: 'W-001', ...current() })
      const finished = (await invoke('get_session', { workstreamId: 'W-001' })).session
      assert.equal(finished.status, 'done')
      assert.equal(finished.completion.eligible, true)
    } finally {
      await transport.close()
      rmSync(root, { recursive: true, force: true })
    }
  })
}
