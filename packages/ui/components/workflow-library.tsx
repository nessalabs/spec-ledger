'use client'

import { ReadableText } from "@/components/readable-text"


import { useEffect, useState } from 'react'
import { Badge, Button } from '@nessalabs/ui'
import type { WorkflowLibraryEntry } from '@nessalabs/spec-ledger-client'
import { readWorkflows, useWorkflowMutation } from '@/lib/workflow-api'
import { useRouter } from 'next/navigation'

type Library = { entries: WorkflowLibraryEntry[]; default: { profileId: string | null; digest: string } }
type Change = { action: 'delete' | 'default'; profileId: string | null; title: string; expectedDigest: string }
const field = 'w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm'

export function WorkflowLibrary({ specs }: { specs: Array<{ id: string; title: string }> }) {
  const router = useRouter()
  const [spec, setSpec] = useState(''), [generation, setGeneration] = useState(0)
  const [library, setLibrary] = useState<Library>()
  const [change, setChange] = useState<Change>()
  const [reason, setReason] = useState(''), [message, setMessage] = useState(''), [loading, setLoading] = useState(true)
  const mutation = useWorkflowMutation('spec-ledger:workflow-library:pending')
  const disabled = mutation.busy || !!mutation.pending
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setMessage('')
    readWorkflows({ library: 'true', ...(spec ? { workstreamId: spec } : {}) }, controller.signal)
      .then(list => { if (!controller.signal.aborted) setLibrary(list.library) })
      .catch(error => { if (!controller.signal.aborted) setMessage(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [spec, generation])
  function changed() { setChange(undefined); setReason(''); setGeneration(n => n + 1) }
  async function confirmChange() {
    if (!change || !reason.trim()) return
    if (await mutation.run({ action: change.action, input: { requestId: crypto.randomUUID(), actor: 'local:browser', reason: reason.trim(), profileId: change.profileId, expectedDigest: change.expectedDigest } })) changed()
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <label className="block w-full max-w-md space-y-2 text-sm">Check compatibility with a spec<select className={field} value={spec} disabled={disabled} onChange={event => setSpec(event.target.value)}><option value="">All saved workflows</option>{specs.map(item => <option key={item.id} value={item.id}><ReadableText>{item.title}</ReadableText></option>)}</select></label>
      <Button disabled={disabled} onClick={() => router.push('/workflows/new')}>New workflow</Button>
    </div>
    {(message || mutation.message) && <p role="status" className="text-sm text-destructive">{message || mutation.message}</p>}
    {mutation.pending && <Button variant="outline" disabled={mutation.busy} onClick={async () => { if (await mutation.run()) changed() }}>Retry pending change</Button>}
    {loading ? <p role="status" className="animate-pulse rounded-xl border border-border p-6 text-sm text-muted-foreground">Loading saved workflows…</p> : library && <div className="space-y-3" aria-label="Saved workflows">
      <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-5">
        <div><h2 className="font-semibold">Spec Ledger default {!library.default.profileId && <Badge variant="outline">Normal</Badge>}</h2><p className="mt-1 text-sm text-muted-foreground">The bundled workflow. Always available.</p></div>
        {library.default.profileId && <Button variant="outline" disabled={disabled} onClick={() => { setChange({ action: 'default', profileId: null, title: 'Spec Ledger default', expectedDigest: library.default.digest }) }}>Use as normal</Button>}
      </article>
      {library.entries.map(entry => <article key={entry.id} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border p-5">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words font-semibold"><ReadableText>{entry.title}</ReadableText></h2>{entry.isDefault && <Badge variant="outline">Normal</Badge>}</div><p className="mt-1 break-all text-xs text-muted-foreground">Saved workflow</p>{spec && <p className={`mt-3 text-sm ${entry.unusableReason ? 'text-destructive' : 'text-muted-foreground'}`}>{entry.unusableReason ?? 'Available for this spec'}</p>}</div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={disabled} onClick={() => router.push(`/workflows/edit/${encodeURIComponent(entry.id)}`)}>Edit <ReadableText>{entry.title}</ReadableText></Button>{!entry.isDefault && <Button variant="outline" disabled={disabled} onClick={() => { setChange({ action: 'default', profileId: entry.id, title: entry.title, expectedDigest: library.default.digest }) }}>Use as normal</Button>}<Button variant="ghost" disabled={disabled} onClick={() => { setChange({ action: 'delete', profileId: entry.id, title: entry.title, expectedDigest: entry.digest }) }}>Delete <ReadableText>{entry.title}</ReadableText></Button></div>
      </article>)}
      {!library.entries.length && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No saved workflows yet. Start with the bundled steps, give them a name, and reuse them across specs.</p>}
    </div>}
    {!loading && <Button variant="ghost" disabled={disabled} onClick={() => setGeneration(n => n + 1)}>Refresh library</Button>}
    {change && <section className="space-y-4 rounded-xl border border-border p-5" aria-label="Confirm library change"><h2 className="font-semibold">{change.action === 'delete' ? `Delete ${change.title}?` : `Use ${change.title} as normal?`}</h2><p className="text-sm text-muted-foreground">Specs that already chose a workflow keep their copied steps and evidence.</p><label className="block space-y-2 text-sm">Why this change?<textarea className={field} maxLength={1000} value={reason} disabled={disabled} onChange={e => setReason(e.target.value)} /></label><div className="flex gap-2"><Button disabled={disabled || !reason.trim()} onClick={confirmChange}>{change.action === 'delete' ? 'Delete workflow' : 'Set normal workflow'}</Button><Button variant="ghost" disabled={disabled} onClick={() => { setChange(undefined); setReason('') }}>Cancel</Button></div></section>}
  </div>
}
