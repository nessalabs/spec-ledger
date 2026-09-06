'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Badge, Button } from '@nessalabs/ui'
import type { SessionProjection, WorkflowLibraryEntry, WorkflowOptions, WorkflowSnapshot } from '@nessalabs/spec-ledger-client'
import { previewWorkflow, readWorkflows, useWorkflowMutation } from '@/lib/workflow-api'

type Workflow = NonNullable<SessionProjection['session']>['workflow']
type Library = { entries: WorkflowLibraryEntry[]; default: { profileId: string | null; digest: string } }
type Preview = { preview: WorkflowSnapshot; options: WorkflowOptions }

export function WorkflowPicker({ workstreamId, workflow }: { workstreamId: string; workflow: Workflow }) {
  const [library, setLibrary] = useState<Library>(), [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('spec-ledger/default'), [reason, setReason] = useState('')
  const [preview, setPreview] = useState<Preview>(), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const mutation = useWorkflowMutation(`spec-ledger:workflow-choice:${workstreamId}`)
  useEffect(() => {
    let controller: AbortController | undefined
    const refresh = () => {
      controller?.abort(); controller = new AbortController()
      const signal = controller.signal
      readWorkflows({ library: 'true', workstreamId }, signal).then(result => { if (!signal.aborted) setLibrary(result.library) }).catch(() => { /* Keep the last observation when disconnected. */ })
    }
    refresh()
    const interval = window.setInterval(refresh, 5000)
    window.addEventListener('focus', refresh)
    return () => { controller?.abort(); clearInterval(interval); window.removeEventListener('focus', refresh) }
  }, [workstreamId, workflow.profile.snapshotDigest])
  const deleted = workflow.profile.source === 'library' && library && !library.entries.some(entry => entry.id === workflow.profile.id)
  async function choose() {
    setBusy(true); setMessage(''); setPreview(undefined)
    try {
      const data = await readWorkflows({ library: 'true', workstreamId })
      setLibrary(data.library)
      setSelected(workflow.profile.source === 'library' && data.library.entries.some((entry: WorkflowLibraryEntry) => entry.id === workflow.profile.id) ? workflow.profile.id : data.library.default.profileId ?? 'spec-ledger/default')
      setOpen(true)
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }
  async function showPreview() {
    setBusy(true); setMessage(''); setPreview(undefined)
    try { setPreview(await previewWorkflow('preview', { workstreamId, profileId: selected })) }
    catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }
  async function apply() {
    if (!preview) return
    const options = preview.options
    if (await mutation.run({ action: 'apply', input: { requestId: crypto.randomUUID(), workstreamId, profileId: selected,
      expectedRevisionDigest: options.expectedRevisionDigest, expectedSourceDigest: options.expectedSourceDigest,
      expectedSnapshotDigest: options.expectedSnapshotDigest, expectedConfigurationDigest: preview.preview.snapshotDigest,
      ...(reason.trim() ? { reason: reason.trim() } : {}) } })) {
      setOpen(false); setPreview(undefined); setReason(''); setMessage('Workflow selected. These copied steps are now available to the agent.')
    }
  }
  const disabled = busy || mutation.busy || !!mutation.pending
  return <section className="space-y-4 rounded-xl border border-border p-5" aria-label="Choose a saved workflow">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold">How should your agent work?</h2><p className="mt-2 break-words text-sm">{workflow.profile.title} {deleted && <Badge variant="outline">Deleted from library</Badge>}</p>{workflow.profile.profileDigest && <p className="mt-1 break-all text-xs text-muted-foreground">Saved version {workflow.profile.profileDigest.slice(0, 8)}</p>}{deleted && <p className="mt-2 text-sm text-muted-foreground">This spec still uses its preserved copy.</p>}</div>{!open && <Button disabled={disabled} onClick={choose}>Choose workflow</Button>}</div>
    <p className="text-sm text-muted-foreground">Choose a saved name here. Define and edit reusable steps in the <Link className="underline" href="/workflows">workflow library</Link>.</p>
    {(message || mutation.message) && <p role="status" className="text-sm">{mutation.message || message}</p>}
    {mutation.pending && <Button variant="outline" disabled={mutation.busy} onClick={async () => { if (await mutation.run()) { setOpen(false); setPreview(undefined); setMessage('Workflow selection recovered.') } }}>Retry pending selection</Button>}
    {open && library && <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
      <label className="block space-y-2 text-sm">Saved workflow<select className="w-full min-w-0 rounded-md border border-input bg-background px-3 py-2" value={selected} onChange={event => { setSelected(event.target.value); setPreview(undefined) }}><option value="spec-ledger/default">Spec Ledger default{!library.default.profileId ? ' · Normal' : ''}</option>{library.entries.map(entry => <option key={entry.id} value={entry.id} disabled={!!entry.unusableReason}>{entry.title}{entry.isDefault ? ' · Normal' : ''}{entry.unusableReason ? ' · Unavailable' : ''}</option>)}</select></label>
      {library.entries.filter(entry => entry.unusableReason).map(entry => <p key={entry.id} className="text-sm text-muted-foreground">{entry.title}: {entry.unusableReason}</p>)}
      <label className="block space-y-2 text-sm">Why choose this workflow?<textarea className="w-full min-w-0 rounded-md border border-input bg-background px-3 py-2" value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /><span className="text-xs text-muted-foreground">Required when replacing a previous selection.</span></label>
      <div className="flex gap-2"><Button onClick={showPreview}>Preview selection</Button><Button variant="ghost" onClick={() => { setOpen(false); setPreview(undefined) }}>Cancel</Button></div>
    </fieldset>}
    {open && preview && <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Selection preview"><h3 className="font-semibold">{preview.preview.profile.title}</h3><ol className="list-inside list-decimal space-y-2 text-sm">{preview.preview.stages.map(stage => <li key={stage.id}>{stage.title}<ul className="ml-5 list-disc text-muted-foreground">{stage.steps.map(step => <li key={step.id}>{step.title}</li>)}</ul></li>)}</ol>{!preview.options.permission.allowed && <p className="text-sm">This spec needs approval before changing its workflow.</p>}<Button onClick={apply} disabled={disabled || !preview.options.permission.allowed || (!!preview.options.expectedSnapshotDigest && !reason.trim())}>Use this workflow</Button></section>}
  </section>
}
