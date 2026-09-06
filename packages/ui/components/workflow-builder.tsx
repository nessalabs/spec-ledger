'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@nessalabs/ui'
import type { LibraryOptions, WorkflowProfile } from '@nessalabs/spec-ledger-client'
import { readWorkflows, useWorkflowMutation } from '@/lib/workflow-api'
import { WorkflowEditor } from '@/components/workflow-editor'

export function WorkflowBuilder({ profileId }: { profileId?: string }) {
  const router = useRouter()
  const [draft, setDraft] = useState<{ profile: WorkflowProfile; digest?: string; options: LibraryOptions }>()
  const [message, setMessage] = useState('')
  const mutation = useWorkflowMutation(`spec-ledger:workflow-builder:${profileId ?? 'new'}:pending`)
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([readWorkflows({ libraryOptions: 'true' }, controller.signal), profileId ? readWorkflows({ profileId }, controller.signal) : Promise.resolve(undefined)])
      .then(([defaults, saved]) => {
        if (controller.signal.aborted) return
        const profile = saved?.profile ?? defaults.options.defaultProfile
        setDraft({ profile: { id: profile.id, title: profile.title, stages: profile.stages, ...(profile.skills ? { skills: profile.skills } : {}) }, digest: saved?.profile.digest, options: defaults.options })
      }).catch(error => { if (!controller.signal.aborted) setMessage(error.message) })
    return () => controller.abort()
  }, [profileId])
  async function save(profile: WorkflowProfile, expectedDigest: string | undefined, reason: string) {
    const {id: _id,...newProfile}=profile
    if (await mutation.run({ action: expectedDigest ? 'update' : 'save', input: { requestId: crypto.randomUUID(), actor: 'local:browser', reason, profile: expectedDigest ? profile : newProfile, ...(expectedDigest ? { expectedDigest } : {}) } })) router.push('/workflows')
  }
  return <div className="-m-6 flex h-[calc(100dvh-3rem)] min-h-0 flex-col">
    {(message || mutation.message) && <p role="status" className="text-sm text-destructive">{message || mutation.message}</p>}
    {mutation.pending && <Button disabled={mutation.busy} onClick={async () => { if (await mutation.run()) router.push('/workflows') }}>Retry pending change</Button>}
    {draft ? <WorkflowEditor initialProfile={draft.profile} expectedDigest={draft.digest} options={draft.options} saveMessage={mutation.message} disabled={mutation.busy || !!mutation.pending} onSave={save} onCancel={() => router.push('/workflows')} /> : !message && <p role="status">Loading workflow…</p>}
  </div>
}
