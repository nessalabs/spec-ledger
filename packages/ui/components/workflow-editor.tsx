'use client'

import { parseWorkflowDraft } from '@/lib/workflow-editor'
import { useState } from 'react'
import { Input, Checkbox, Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@nessalabs/ui'
import { ChevronDown } from 'lucide-react'
import type { WorkflowOptions, WorkflowProfile, WorkflowProfileStage, WorkflowOutputKind, WorkflowStageRole, WorkflowSnapshot } from '@nessalabs/spec-ledger-client'

const roles: Record<WorkflowStageRole, string> = { plan: 'Planning', 'spec-review': 'Plan review', implement: 'Coding', verify: 'Testing', 'code-review': 'Code review' }
const outputs: Record<WorkflowOutputKind, string> = { 'spec-revision': 'Preserved spec', 'spec-review': 'Plan review', 'implementation-report': 'Implementation report', 'check-results': 'Passing tests', 'code-review': 'Code review', attestation: 'Written observation (not a test)' }
const expected: Record<WorkflowStageRole, WorkflowOutputKind> = { plan: 'spec-revision', 'spec-review': 'spec-review', implement: 'implementation-report', verify: 'check-results', 'code-review': 'code-review' }
const field = 'w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm'
type Preview = { preview: WorkflowSnapshot; options: WorkflowOptions }
type Pending = Record<string, unknown>

function Choice({ label, value, choices, onChange }: { label: string; value: string; choices: Array<[string, string]>; onChange: (value: string) => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" className="w-full justify-between" aria-label={label}><span className="truncate">{choices.find(([id]) => id === value)?.[1] ?? value}</span><ChevronDown className="ml-2 size-4 shrink-0" /></Button></DropdownMenuTrigger><DropdownMenuContent className="max-h-80 max-w-[calc(100vw-3rem)] overflow-auto"><DropdownMenuRadioGroup value={value} onValueChange={onChange}>{choices.map(([id, title]) => <DropdownMenuRadioItem key={id} value={id}>{title}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
}

async function json(response: Response) {
  const body = await response.json()
  if (!response.ok) throw Object.assign(new Error(body.error ?? 'The workflow request failed.'), { rejected: true })
  return body
}

export function WorkflowEditor({ workstreamId }: { workstreamId: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const [options, setOptions] = useState<WorkflowOptions>(), [profile, setProfile] = useState<WorkflowProfile>()
  const [preview, setPreview] = useState<Preview>(), [reason, setReason] = useState(''), [pending, setPending] = useState<Pending>()
  const storageKey = `spec-ledger:workflow-save:${workstreamId}`
  async function observe() { return json(await fetch(`/api/workflows?workstreamId=${encodeURIComponent(workstreamId)}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) })) }
  async function edit() {
    setBusy(true); setMessage('')
    try {
      const result = await observe(); setOptions(result.options); setProfile(result.options.profile); setOpen(true)
      const saved = sessionStorage.getItem(storageKey)
      if (saved) { setPending(JSON.parse(saved)); setMessage('A previous save has an uncertain result. Retry it to recover the same selection before editing.') }
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }
  function change(update: (draft: WorkflowProfile) => void) { if (!profile) return; const draft = structuredClone(profile); update(draft); setProfile(draft); setPreview(undefined); setMessage('') }
  function stageChange(index: number, update: (stage: WorkflowProfileStage) => void) { change(d => update(d.stages![index]!)) }
  async function showPreview() {
    setBusy(true); setMessage(''); setPreview(undefined)
    try {
      const { token } = await observe()
      const result = await json(await fetch('/api/workflows', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spec-ledger-token': token }, body: JSON.stringify({ action: 'preview', input: { workstreamId, profile } }), signal: AbortSignal.timeout(10000) }))
      setPreview(result); setOptions(result.options)
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }
  async function apply() {
    const input = pending ?? (preview && { requestId: crypto.randomUUID(), workstreamId, profile, expectedRevisionDigest: preview.options.expectedRevisionDigest, expectedSourceDigest: preview.options.expectedSourceDigest, expectedSnapshotDigest: preview.options.expectedSnapshotDigest, expectedConfigurationDigest: preview.preview.snapshotDigest, ...(reason.trim() ? { reason: reason.trim() } : {}) })
    if (!input) return
    setBusy(true); setMessage('')
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(input)); setPending(input)
      const { token } = await observe()
      await json(await fetch('/api/workflows', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spec-ledger-token': token }, body: JSON.stringify({ action: 'apply', input }), signal: AbortSignal.timeout(15000) }))
      sessionStorage.removeItem(storageKey); setPending(undefined); setPreview(undefined); setOpen(false)
      setMessage('Workflow applied. Your agent can now read and follow these steps through CLI or MCP. No agent was launched.')
    } catch (error) {
      if ((error as Error & { rejected?: boolean }).rejected) { sessionStorage.removeItem(storageKey); setPending(undefined); setPreview(undefined) }
      setMessage(`${(error as Error).message}${!(error as { rejected?: boolean }).rejected ? ' Save result is uncertain. Retry the same save to recover its result.' : ' Preview again after resolving this issue.'}`)
    } finally { setBusy(false) }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'workflow.json'; a.click(); URL.revokeObjectURL(url)
  }
  return <section className="space-y-4 rounded-xl border border-border p-4" aria-label="Choose a workflow">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">How should your agent work?</h2><p className="text-sm text-muted-foreground">Choose its steps and skills. Required reviews and evidence still apply.</p></div>{!open && <Button onClick={edit} disabled={busy}>Choose workflow</Button>}</div>
    {message && <p role="status" className="text-sm">{message}</p>}
    {open && profile && options && <>
      <fieldset disabled={busy || !!pending} className="min-w-0 space-y-5 disabled:opacity-60">
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setProfile(structuredClone(options.defaultProfile)); setPreview(undefined) }}>Start from default</Button><Button variant="outline" onClick={download}>Export workflow</Button><label className="cursor-pointer rounded-md border border-input px-3 py-2 text-sm">Import workflow<Input className="mt-2 block max-w-full text-xs" type="file" accept=".json,application/json" aria-label="Import workflow" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 131072) throw Error('Workflow file is too large.'); const imported = parseWorkflowDraft(await file.text()); setProfile(imported); setPreview(undefined); setMessage('Imported as a draft. Preview validates it before applying.') } catch (error) { setMessage((error as Error).message) } }} /></label></div>
        <label className="block space-y-1 text-sm">Workflow name<Input className={field} value={profile.title} maxLength={200} onChange={e => change(d => { d.title = e.target.value })} /></label>
        <p className="text-sm text-muted-foreground">Steps run in stage order. Within each stage, every step needs its own recorded result. Local skill files are guidance; their quality is not automatically verified.</p>
        {profile.stages?.map((stage, index) => <details key={`${index}-${stage.id}`} className="space-y-3 rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">{index + 1}. {stage.title} · {stage.steps.length} {stage.steps.length === 1 ? "step" : "steps"}</summary>
          <div className="flex flex-wrap gap-2"><strong className="mr-auto text-sm">Stage {index + 1}</strong><Button variant="ghost" size="sm" disabled={index === 0} aria-label={`Move stage ${index + 1} up`} onClick={() => change(d => { [d.stages![index - 1], d.stages![index]] = [d.stages![index]!, d.stages![index - 1]!] })}>Up</Button><Button variant="ghost" size="sm" disabled={index === profile.stages!.length - 1} aria-label={`Move stage ${index + 1} down`} onClick={() => change(d => { [d.stages![index + 1], d.stages![index]] = [d.stages![index]!, d.stages![index + 1]!] })}>Down</Button><Button variant="ghost" size="sm" onClick={() => change(d => { d.stages!.splice(index, 1) })}>Remove stage</Button></div>
          <label className="block text-sm">Stage name<Input className={field} value={stage.title} onChange={e => stageChange(index, s => { s.title = e.target.value })} /></label>
          <Choice label={`Stage ${index + 1} purpose`} value={stage.role} choices={Object.entries(roles)} onChange={v => stageChange(index, s => { s.role = v as WorkflowStageRole })} />
          {stage.steps.map((step, si) => <div key={`${si}-${step.id}`} className="space-y-3 border-l-2 border-border pl-3">
            <label className="block text-sm">Step {si + 1}<Input className={field} value={step.title} onChange={e => stageChange(index, s => { s.steps[si]!.title = e.target.value })} /></label>
            <Choice label={`Skill for ${step.title}`} value={typeof step.skill === 'string' ? step.skill : 'local'} choices={[...Object.entries(roles).map(([id, title]): [string, string] => [`spec-ledger/${id}`, `Default: ${title}`]), ['local', 'Choose a local skill']]} onChange={v => stageChange(index, s => { s.steps[si]!.skill = v === 'local' ? { path: '', acknowledgeUncertain: false } : v })} />
            {typeof step.skill !== 'string' && <><Choice label={`Local skill for ${step.title}`} value={step.skill.path} choices={[['', 'Select a skill file'], ...options.localSkills.map(path => [path, path] as [string, string])]} onChange={v => stageChange(index, s => { s.steps[si]!.skill = { path: v, acknowledgeUncertain: false } })} /><label className="block text-sm">Or enter a path inside this project<Input className={field} value={step.skill.path} onChange={e => stageChange(index, s => { s.steps[si]!.skill = { path: e.target.value, acknowledgeUncertain: false } })} /></label><label className="flex items-start gap-2 text-sm"><Checkbox checked={step.skill.acknowledgeUncertain === true || !!step.skill.capabilities?.length} onChange={e => stageChange(index, s => { const skill = s.steps[si]!.skill; if (typeof skill !== 'string') { delete skill.capabilities; skill.acknowledgeUncertain = e.target.checked } })} />I have reviewed this skill and accept that its suitability is not verified.</label></>}
            <fieldset className="space-y-1"><legend className="text-sm font-medium">What must this step produce?</legend>{Object.entries(outputs).map(([kind, label]) => <label key={kind} className="flex gap-2 text-sm"><Checkbox checked={step.outputs.some(o => o.kind === kind)} onChange={e => stageChange(index, s => { const target = s.steps[si]!; target.outputs = e.target.checked ? [...target.outputs, { kind: kind as WorkflowOutputKind, ...(['implementation-report', 'check-results'].includes(kind) ? { criterionIds: options.defaultProfile.stages!.flatMap(st => st.steps.flatMap(sp => sp.outputs.find(o => o.kind === kind)?.criterionIds ?? [])) } : {}) }] : target.outputs.filter(o => o.kind !== kind) })} />{label}</label>)}</fieldset>
            <div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" disabled={si === 0} onClick={() => stageChange(index, s => { [s.steps[si - 1], s.steps[si]] = [s.steps[si]!, s.steps[si - 1]!] })}>Move step up</Button><Button variant="ghost" size="sm" disabled={si === stage.steps.length - 1} onClick={() => stageChange(index, s => { [s.steps[si + 1], s.steps[si]] = [s.steps[si]!, s.steps[si + 1]!] })}>Move step down</Button><Button variant="ghost" size="sm" onClick={() => stageChange(index, s => { s.steps.splice(si, 1) })}>Remove step</Button></div>
          </div>)}
          <Button variant="outline" disabled={stage.steps.length >= 20} onClick={() => stageChange(index, s => { s.steps.push({ id: `step-${crypto.randomUUID()}`, title: 'New step', skill: `spec-ledger/${s.role}`, outputs: structuredClone(options.defaultProfile.stages!.find(st => st.role === s.role)!.steps[0]!.outputs) }) })}>Add step</Button>
        </details>)}
        <Button variant="outline" disabled={(profile.stages?.length ?? 0) >= 20} onClick={() => change(d => { d.stages!.push({ id: `stage-${crypto.randomUUID()}`, title: 'New stage', role: 'implement', steps: [{ id: 'implement', title: 'Implement the work', skill: 'spec-ledger/implement', outputs: [{ kind: expected.implement }] }] }) })}>Add stage</Button>
        {options.truncated && <p className="text-sm">Skill discovery reached its limit. You can enter a project-relative path.</p>}
        {options.expectedSnapshotDigest && <label className="block text-sm">Why change this workflow?<textarea className={field} value={reason} maxLength={1000} onChange={e => { setReason(e.target.value); setPreview(undefined) }} /><span className="text-muted-foreground">Earlier selections remain in history. The replacement requires new step attempts.</span></label>}
        <div className="flex gap-2"><Button onClick={showPreview}>Preview workflow</Button><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
      </fieldset>
      {preview && <section className="space-y-3 rounded-lg border border-border p-4"><h3 className="font-semibold">Review before applying: {preview.preview.profile.title}</h3>{preview.preview.stages.map(stage => <div key={stage.id}><h4 className="font-medium">{stage.title}</h4>{stage.steps.map(step => <details key={step.id} className="my-2 rounded border border-border p-2 text-sm"><summary>{step.title} · {step.outputs.map(o => outputs[o.kind]).join(', ')}</summary><p className="my-2">{step.skill.path ?? 'Bundled guidance'}</p><pre className="whitespace-pre-wrap font-sans">{step.skill.content}</pre></details>)}</div>)}{!preview.options.permission.allowed && <p>Applying needs permission for this spec first.</p>}<Button onClick={apply} disabled={busy || !preview.options.permission.allowed || (!!preview.options.expectedSnapshotDigest && !reason.trim())}>Apply workflow</Button></section>}
      {pending && <Button disabled={busy} onClick={apply}>Retry same save</Button>}
    </>}
  </section>
}
