'use client'

import { ReadableText } from "@/components/readable-text"


import { previewWorkflow } from '@/lib/workflow-api'
import { useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, WorkflowCanvas, WorkflowCanvasGrid, WorkflowCanvasSurface, WorkflowCanvasNode, WorkflowCanvasEdges, WorkflowCanvasEdge, Input, Checkbox, Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@nessalabs/ui'
import { ChevronDown } from 'lucide-react'
import type { LibraryOptions, WorkflowProfile, WorkflowProfileStage, WorkflowOutputKind, WorkflowStageRole, WorkflowSnapshot } from '@nessalabs/spec-ledger-client'

const roles: Record<WorkflowStageRole, string> = { plan: 'Planning', 'spec-review': 'Plan review', implement: 'Coding', verify: 'Testing', 'code-review': 'Code review' }
const outputs: Record<WorkflowOutputKind, string> = { 'spec-revision': 'Preserved spec', 'spec-review': 'Plan review', 'implementation-report': 'Implementation report', 'check-results': 'Passing tests', 'code-review': 'Code review', attestation: 'Written observation (not a test)' }
const expected: Record<WorkflowStageRole, WorkflowOutputKind> = { plan: 'spec-revision', 'spec-review': 'spec-review', implement: 'implementation-report', verify: 'check-results', 'code-review': 'code-review' }
const field = 'w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm'
type Preview = { preview: WorkflowSnapshot }

function Choice({ label, value, choices, onChange }: { label: string; value: string; choices: Array<[string, string]>; onChange: (value: string) => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" className="w-full justify-between" aria-label={label}><span className="truncate"><ReadableText>{choices.find(([id]) => id === value)?.[1] ?? value}</ReadableText></span><ChevronDown className="ml-2 size-4 shrink-0" /></Button></DropdownMenuTrigger><DropdownMenuContent className="max-h-80 max-w-[calc(100vw-3rem)] overflow-auto"><DropdownMenuRadioGroup value={value} onValueChange={onChange}>{choices.map(([id, title]) => <DropdownMenuRadioItem key={id} value={id}><ReadableText>{title}</ReadableText></DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
}

export function WorkflowEditor({ initialProfile, expectedDigest, options, disabled, saveMessage, onSave, onCancel }: {
  initialProfile: WorkflowProfile; expectedDigest?: string; options: LibraryOptions; disabled: boolean; saveMessage?: string;
  onSave: (profile: WorkflowProfile, expectedDigest: string | undefined, reason: string) => Promise<void>; onCancel: () => void
}) {
  const [selectedStage, setSelectedStage] = useState<string>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profile, setProfile] = useState<WorkflowProfile>(initialProfile)
  const [preview, setPreview] = useState<Preview>(), [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  function change(update: (draft: WorkflowProfile) => void) { if (!profile) return; const draft = structuredClone(profile); update(draft); setProfile(draft); setPreview(undefined); setMessage('') }
  function stageChange(index: number, update: (stage: WorkflowProfileStage) => void) { change(d => update(d.stages![index]!)) }
  async function showPreview() {
    setBusy(true); setMessage(''); setPreview(undefined)
    try { setPreview(await previewWorkflow('validate', { profile })) }
    catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'workflow.json'; a.click(); URL.revokeObjectURL(url)
  }
  return <section className="flex h-full min-h-0 flex-col" aria-label="Define a saved workflow">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
      <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" onClick={onCancel}>← Workflows</Button><div className="min-w-0"><h1 className="truncate text-sm font-semibold">{profile.title || 'New workflow'}</h1><p className="text-xs text-muted-foreground">Workflow builder</p></div></div>
      <div className="flex gap-2"><Button variant="outline" disabled={busy || disabled} onClick={() => setSettingsOpen(true)}>Workflow settings</Button><Button disabled={busy || disabled} onClick={showPreview}>Preview workflow</Button></div>
    </header>
    {message && <p role="status" className="px-4 py-2 text-sm"><ReadableText>{message}</ReadableText></p>}
    <div className="relative min-h-0 flex-1 overflow-hidden">
            <WorkflowCanvas aria-label="Workflow builder canvas" defaultViewport={{ x: 24, y: 24, zoom: 0.9 }}>
              <WorkflowCanvasGrid />
              <WorkflowCanvasSurface>
                <WorkflowCanvasEdges>{profile.stages?.slice(1).map((stage, index) => <WorkflowCanvasEdge key={stage.id} source={profile.stages![index]!.id} target={stage.id} sourceSide="bottom" targetSide="top" />)}</WorkflowCanvasEdges>
                {profile.stages?.map((stage, index) => <WorkflowCanvasNode key={stage.id} nodeId={stage.id} position={{ x: 28, y: index * 148 }} selected={selectedStage === stage.id} aria-label={`Stage ${index + 1}`}>
                  <button type="button" disabled={busy || disabled} onClick={() => setSelectedStage(stage.id)} className="w-72 rounded-xl border border-border bg-card p-4 text-left shadow-sm" aria-pressed={selectedStage === stage.id}>
                    <span className="text-xs font-medium text-muted-foreground">{roles[stage.role]} · {stage.steps.length} {stage.steps.length === 1 ? 'step' : 'steps'}</span>
                    <span className="mt-2 block font-semibold">{index + 1}. <ReadableText>{stage.title}</ReadableText></span>
                    <span className="mt-2 block text-xs text-muted-foreground">Select to edit steps and required results</span>
                  </button>
                </WorkflowCanvasNode>)}
              </WorkflowCanvasSurface>
            </WorkflowCanvas>
      <div className="absolute bottom-4 left-4 rounded-lg border border-border bg-background p-2 shadow-sm">
        <Button variant="outline" disabled={busy || disabled || (profile.stages?.length ?? 0) >= 20} onClick={() => change(d => { const id = crypto.randomUUID(); setSelectedStage(id); d.stages!.push({ id, title: 'New stage', role: 'implement', steps: [{ id: crypto.randomUUID(), title: 'Implement the work', skill: 'spec-ledger/implement', outputs: [{ kind: expected.implement }] }] }) })}>Add stage</Button>

      </div>
    </div>
    <Drawer open={!!selectedStage && profile.stages?.some(stage => stage.id === selectedStage)} onOpenChange={open => { if (!open) setSelectedStage(undefined) }}>
      <DrawerContent resizable><DrawerHeader><DrawerTitle>{profile.stages?.find(stage => stage.id === selectedStage)?.title ?? 'Stage details'}</DrawerTitle><DrawerDescription>Edit the steps and required results for this stage.</DrawerDescription></DrawerHeader><DrawerBody>
        <fieldset disabled={busy || disabled} className="space-y-4 disabled:opacity-60">
        {profile.stages?.map((stage, index) => stage.id === selectedStage && <div key={`${index}-${stage.id}`} className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex flex-wrap gap-2"><strong className="mr-auto text-sm">Stage {index + 1}</strong><Button variant="ghost" size="sm" disabled={index === 0} aria-label={`Move stage ${index + 1} up`} onClick={() => change(d => { [d.stages![index - 1], d.stages![index]] = [d.stages![index]!, d.stages![index - 1]!] })}>Up</Button><Button variant="ghost" size="sm" disabled={index === profile.stages!.length - 1} aria-label={`Move stage ${index + 1} down`} onClick={() => change(d => { [d.stages![index + 1], d.stages![index]] = [d.stages![index]!, d.stages![index + 1]!] })}>Down</Button><Button variant="ghost" size="sm" onClick={() => change(d => { d.stages!.splice(index, 1) })}>Remove stage</Button></div>
          <label className="block text-sm">Stage name<Input className={field} value={stage.title} onChange={e => stageChange(index, s => { s.title = e.target.value })} /></label>
          <Choice label={`Stage ${index + 1} purpose`} value={stage.role} choices={Object.entries(roles)} onChange={v => stageChange(index, s => { s.role = v as WorkflowStageRole })} />
          {stage.steps.map((step, si) => <div key={`${si}-${step.id}`} className="space-y-3 border-l-2 border-border pl-3">
            <label className="block text-sm">Step {si + 1}<Input className={field} value={step.title} onChange={e => stageChange(index, s => { s.steps[si]!.title = e.target.value })} /></label>
            <Choice label={`Skill for ${step.title}`} value={typeof step.skill === 'string' ? step.skill : 'local'} choices={[...Object.entries(roles).map(([id, title]): [string, string] => [`spec-ledger/${id}`, `Default: ${title}`]), ['local', 'Choose a local skill']]} onChange={v => stageChange(index, s => { s.steps[si]!.skill = v === 'local' ? { path: '', acknowledgeUncertain: false } : v })} />
            {typeof step.skill !== 'string' && <><Choice label={`Local skill for ${step.title}`} value={step.skill.path} choices={[['', 'Select a skill file'], ...options.localSkills.map(path => [path, path] as [string, string])]} onChange={v => stageChange(index, s => { s.steps[si]!.skill = { path: v, acknowledgeUncertain: false } })} /><label className="block text-sm">Or enter a path inside this project<Input className={field} value={step.skill.path} onChange={e => stageChange(index, s => { s.steps[si]!.skill = { path: e.target.value, acknowledgeUncertain: false } })} /></label><label className="flex items-start gap-2 text-sm"><Checkbox checked={step.skill.acknowledgeUncertain === true || !!step.skill.capabilities?.length} onChange={e => stageChange(index, s => { const skill = s.steps[si]!.skill; if (typeof skill !== 'string') { delete skill.capabilities; skill.acknowledgeUncertain = e.target.checked } })} />I have reviewed this skill and accept that its suitability is not verified.</label></>}
            <fieldset className="space-y-1"><legend className="text-sm font-medium">What must this step produce?</legend>{Object.entries(outputs).map(([kind, label]) => <label key={kind} className="flex gap-2 text-sm"><Checkbox checked={step.outputs.some(o => o.kind === kind)} onChange={e => stageChange(index, s => { const target = s.steps[si]!; target.outputs = e.target.checked ? [...target.outputs, { kind: kind as WorkflowOutputKind }] : target.outputs.filter(o => o.kind !== kind) })} /><ReadableText>{label}</ReadableText></label>)}</fieldset>
            <div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" disabled={si === 0} onClick={() => stageChange(index, s => { [s.steps[si - 1], s.steps[si]] = [s.steps[si]!, s.steps[si - 1]!] })}>Move step up</Button><Button variant="ghost" size="sm" disabled={si === stage.steps.length - 1} onClick={() => stageChange(index, s => { [s.steps[si + 1], s.steps[si]] = [s.steps[si]!, s.steps[si + 1]!] })}>Move step down</Button><Button variant="ghost" size="sm" onClick={() => stageChange(index, s => { s.steps.splice(si, 1) })}>Remove step</Button></div>
          </div>)}
          <Button variant="outline" disabled={stage.steps.length >= 20} onClick={() => stageChange(index, s => { s.steps.push({ id: crypto.randomUUID(), title: 'New step', skill: `spec-ledger/${s.role}`, outputs: structuredClone(options.defaultProfile.stages!.find(st => st.role === s.role)!.steps[0]!.outputs) }) })}>Add step</Button>
        </div>)}

        </fieldset>
      </DrawerBody></DrawerContent>
    </Drawer>
    <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}><DrawerContent><DrawerHeader><DrawerTitle>Workflow settings</DrawerTitle><DrawerDescription>Name this reusable workflow or import an existing definition.</DrawerDescription></DrawerHeader><DrawerBody><fieldset disabled={busy || disabled} className="space-y-4">
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setProfile({ ...structuredClone(options.defaultProfile), id: profile.id, title: profile.title }); setPreview(undefined) }}>Start from default</Button><Button variant="outline" onClick={download}>Export workflow</Button><label className="cursor-pointer rounded-md border border-input px-3 py-2 text-sm">Import workflow<Input className="mt-2 block max-w-full text-xs" type="file" accept=".json,application/json" aria-label="Import workflow" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 131072) throw Error('Workflow file is too large.'); const imported = JSON.parse(await file.text()); await previewWorkflow('validate', { profile: imported }); setProfile(expectedDigest ? { ...imported, id: profile.id } : imported); setPreview(undefined); setMessage('Imported and validated. Review before saving.') } catch (error) { setMessage((error as Error).message) } }} /></label></div>
        <label className="block space-y-1 text-sm">Workflow name<Input className={field} value={profile.title} maxLength={200} onChange={e => change(d => { d.title = e.target.value })} /></label>

    </fieldset></DrawerBody></DrawerContent></Drawer>
      <Drawer open={!!preview} onOpenChange={open => { if (!open) setPreview(undefined) }}><DrawerContent><DrawerHeader><DrawerTitle>Review workflow</DrawerTitle><DrawerDescription>Check the steps before saving.</DrawerDescription></DrawerHeader><DrawerBody>{preview && <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Workflow preview">{saveMessage && <p role="status" className="text-sm text-destructive">{saveMessage} Close the preview to return to the builder.</p>}<h3 className="font-semibold">Review before saving: <ReadableText>{preview.preview.profile.title}</ReadableText></h3>{preview.preview.stages.map(stage => <div key={stage.id}><h4 className="font-medium"><ReadableText>{stage.title}</ReadableText></h4>{stage.steps.map(step => <details key={step.id} className="my-2 rounded border border-border p-2 text-sm"><summary><ReadableText>{step.title}</ReadableText> · {step.outputs.map(o => outputs[o.kind]).join(', ')}</summary><p className="my-2">{step.skill.path ?? 'Bundled guidance'}</p><pre className="whitespace-pre-wrap font-sans">{step.skill.content}</pre></details>)}</div>)}<label className="block space-y-1 text-sm">Why save this workflow?<textarea className={field} value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /></label><Button onClick={() => onSave(profile, expectedDigest, reason.trim())} disabled={busy || disabled || !reason.trim()}>Save workflow</Button></section>}</DrawerBody></DrawerContent></Drawer>
  </section>
}
