'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Badge, CodeBlock } from '@nessalabs/ui'
import type { CheckEvidence, CheckRun } from '@nessalabs/spec-ledger-client'

type StartRequest = { requestId: string; bindingId: string; expectedSourceDigest: string; expectedCheckDigest: string }
const active = (run: CheckRun | null) => run?.state === 'queued' || run?.state === 'running'

async function readEvidence(bindingId: string, signal?: AbortSignal): Promise<CheckEvidence> {
  const response = await fetch(`/api/checks?bindingId=${encodeURIComponent(bindingId)}`, { cache: 'no-store', signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Evidence could not be loaded.')
  return data
}

export function CheckEvidencePanel({ bindingId, initial, defaultOpen = false }: { bindingId: string; initial?: CheckEvidence; defaultOpen?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen)
  const [evidence, setEvidence] = useState<CheckEvidence | null>(initial ?? null)
  const [run, setRun] = useState<CheckRun | null>(null)
  const [message, setMessage] = useState('')
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  const pending = useRef<StartRequest | null>(null)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void readEvidence(bindingId, controller.signal).then(data => {
      setEvidence(data)
      setRun(data.runs.find(candidate => active(candidate)) ?? data.runs[0] ?? null)
    }).catch(error => { if (!controller.signal.aborted) setMessage(error.message) })
    return () => controller.abort()
  }, [bindingId, open])

  const runningId = active(run) ? run!.runId : null
  useEffect(() => {
    if (!runningId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      try {
        const response = await fetch(`/api/checks?runId=${encodeURIComponent(runningId)}`, { cache: 'no-store', signal: controller.signal })
        const next = await response.json()
        if (!response.ok) throw new Error(next.error ?? 'Run status is unavailable.')
        if (!active(next)) {
          const current = await readEvidence(bindingId, controller.signal)
          setEvidence(current)
          setRun(next)
          setMessage(next.reason ?? "Run finished. Output and current evidence are available below.")
          router.refresh()
        } else {
          setRun(next)
          timer = setTimeout(poll, 1500)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setMessage(`Connection interrupted. The check may still be running. ${error instanceof Error ? error.message : ''}`)
          timer = setTimeout(poll, 3000)
        }
      }
    }
    timer = setTimeout(poll, 1000)
    return () => { controller.abort(); if (timer) clearTimeout(timer) }
  }, [runningId, bindingId, router])

  async function refresh() {
    try {
      const data = await readEvidence(bindingId)
      setEvidence(data)
      setRun(data.runs.find(candidate => active(candidate)) ?? data.runs[0] ?? null)
      setMessage('Evidence refreshed. No check was executed.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Refresh failed.') }
  }

  async function start() {
    if (!evidence?.sourceDigest || !evidence.command || startingRef.current || active(run)) return
    startingRef.current = true
    setStarting(true)
    setMessage('Submitting the saved check…')
    const input = pending.current ?? { requestId: crypto.randomUUID(), bindingId, expectedSourceDigest: evidence.sourceDigest, expectedCheckDigest: evidence.checkDigest }
    pending.current = input
    try {
      const tokenResponse = await fetch('/api/checks', { cache: 'no-store' })
      const token = await tokenResponse.json()
      if (!tokenResponse.ok) throw new Error(token.error ?? 'Local execution is unavailable.')
      const response = await fetch('/api/checks', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spec-ledger-token': token.token }, body: JSON.stringify(input) })
      const next = await response.json()
      if (!response.ok) {
        if (next.code === 'source_conflict' || next.code === 'invalid_input') pending.current = null
        throw new Error(next.error ?? 'The saved check could not be started. Refresh its evidence before retrying.')
      }
      pending.current = null
      setRun(next)
      setMessage(active(next) ? 'The saved check is running. This page will show its result.' : next.reason ?? 'Run status received.')
      if (!active(next)) { setEvidence(await readEvidence(bindingId)); router.refresh() }
    } catch (error) {
      setMessage(`${error instanceof Error ? error.message : 'Run request interrupted.'}${pending.current ? ' Retry reconnects to the same request; it does not start a second execution.' : ''}`)
    } finally { startingRef.current = false; setStarting(false) }
  }

  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="rounded-xl border border-border p-4">
    <summary className="cursor-pointer font-medium">Inspect test, output and source</summary>
    <div className="mt-4 space-y-5">
      {!evidence ? <p role="status">{message || 'Loading saved evidence…'}</p> : <>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{evidence.test?.level ?? 'Test level not recorded'}</Badge><span className="text-sm">Current evidence: {evidence.currentOutcome}</span></div>
        <section><h4 className="font-medium">What this checks</h4><p className="mt-1 text-sm">{evidence.test?.description ?? 'No explanation was recorded. Inspect the test source and assertions below.'}</p></section>
        <div className="grid gap-4 sm:grid-cols-2"><TextBlock title="Input / setup · recorded description" text={evidence.test?.inputs ?? 'Not recorded. The source may define fixtures or multiple scenarios.'}/><TextBlock title="Expected behavior · recorded description" text={evidence.test?.expected ?? 'Not recorded. Read the assertions before interpreting a passing exit status.'}/></div>
        <section className="space-y-2"><h4 className="font-medium">Test source</h4>{evidence.test?.source?.name && <p className="text-sm">{evidence.test.source.name}</p>}<p className="break-all text-xs text-muted-foreground">{evidence.source.path ?? 'No source reference recorded'}</p>{evidence.source.status === 'available' ? <div className="max-h-[32rem] overflow-auto rounded-lg"><CodeBlock code={evidence.source.text ?? ''} filename={evidence.source.path ?? undefined} mode="dark" lineNumbers wrap /></div> : <p className="text-sm">{evidence.source.reason ?? 'Source is unavailable.'}</p>}</section>
        <section className="space-y-2"><h4 className="font-medium">Saved command</h4>{evidence.command ? <CodeBlock code={evidence.command} language="shell" mode="dark" wrap /> : <p className="text-sm">This check is supplied by an external reporter and cannot be run here.</p>}<p className="break-all text-xs text-muted-foreground">Directory: {evidence.cwd}</p><p className="text-xs text-muted-foreground">Run again executes this saved repository command. Opening or refreshing evidence does not execute it.</p>
          <div className="flex flex-wrap gap-2"><Button disabled={starting || active(run) || !evidence.command || !evidence.sourceDigest} onClick={() => void start()}>{starting ? 'Starting…' : active(run) ? 'Running…' : pending.current ? 'Reconnect to request' : 'Run again'}</Button><Button variant="outline" onClick={() => void refresh()}>Refresh evidence</Button></div>
        </section>
        {message && <p role="status" className="text-sm">{message}</p>}
        {run ? <><p className="text-sm text-muted-foreground">{run.sourceDigest !== evidence.sourceDigest || run.checkDigest !== evidence.checkDigest ? "Historical run: its source or check differs from the current version. This result does not verify the current version." : "This run used the source and check identities shown above."}</p><RunOutput run={run}/></> : <p className="text-sm">No detailed run output was captured. Older exit-status records do not contain logs; a new run can capture them.</p>}
        <details><summary className="cursor-pointer text-xs text-muted-foreground">Source and check identities</summary><p className="mt-2 break-all text-xs">Current source: {evidence.sourceDigest ?? 'Unavailable'}<br/>Check: {evidence.checkDigest}<br/>Test source: {evidence.source.sha256 ?? 'Not recorded'}</p></details>
      </>}
    </div>
  </details>
}

function TextBlock({title, text}: {title: string; text: string}) {
  return <section><h4 className="text-sm font-medium">{title}</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{text}</p></section>
}

function RunOutput({run}: {run: CheckRun}) {
  return <section className="space-y-3" aria-label="Actual test output"><h4 className="font-medium">Actual run result · {run.state}</h4><p className="text-sm">{run.outcome ?? 'No outcome yet'}{run.exitCode !== undefined ? ` · exit ${run.exitCode}` : ''}{run.durationMs !== undefined ? ` · ${run.durationMs} ms` : ''}</p><p className="text-xs text-muted-foreground">Started {run.startedAt}{run.finishedAt ? ` · Finished ${run.finishedAt}` : ''}</p>{run.reason && <p className="text-sm">{run.reason}</p>}{(['stdout','stderr'] as const).map(key => <section key={key}><h5 className="text-sm font-medium">{key === 'stdout' ? 'Standard output' : 'Error output'}{run[key]?.truncated ? ' · truncated' : ''}</h5><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-3 text-xs">{run[key]?.status === 'intact' ? run[key]?.text || '(empty)' : active(run) ? 'Output will be available when this run finishes.' : 'Output not captured or its integrity could not be verified.'}</pre></section>)}<details><summary className="cursor-pointer text-xs">Run provenance</summary><p className="mt-2 break-all text-xs">Run: {run.runId}<br/>Source: {run.sourceDigest}<br/>Check: {run.checkDigest}<br/>Directory: {run.cwd}</p><pre className="whitespace-pre-wrap break-words text-xs">{run.command}</pre></details></section>
}
