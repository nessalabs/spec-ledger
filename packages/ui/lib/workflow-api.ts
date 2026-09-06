'use client'

import { useEffect, useState } from 'react'

export async function workflowJson(response: Response) {
  const body = await response.json()
  if (!response.ok) throw Object.assign(new Error(body.error ?? 'The workflow request failed.'), { rejected: true, code: body.code })
  return body
}
export async function readWorkflows(query: Record<string, string>, signal?: AbortSignal) {
  return workflowJson(await fetch(`/api/workflows?${new URLSearchParams(query)}`, { cache: 'no-store', signal: signal ?? AbortSignal.timeout(10000) }))
}
export async function previewWorkflow(action: 'preview' | 'validate', input: Record<string, unknown>) {
  const { token } = await readWorkflows({ library: 'true' })
  return workflowJson(await fetch('/api/workflows', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spec-ledger-token': token }, body: JSON.stringify({ action, input }), signal: AbortSignal.timeout(10000) }))
}
export type WorkflowMutation = { action: 'save' | 'update' | 'delete' | 'default' | 'apply'; input: Record<string, unknown> }

/** Keep the exact request across network uncertainty, including a page reload. */
export function useWorkflowMutation(storageKey: string) {
  const [pending, setPending] = useState<WorkflowMutation>()
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey)
      if (stored) { setPending(JSON.parse(stored)); setMessage('A previous change has an uncertain result. Retry that change before editing.') }
    } catch { setMessage('The previous request could not be read from this browser.') }
  }, [storageKey])
  async function run(request?: WorkflowMutation): Promise<boolean> {
    const next = pending ?? request
    if (!next) return false
    setBusy(true); setMessage('')
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next)); setPending(next)
      const { token } = await readWorkflows({ library: 'true' })
      await workflowJson(await fetch('/api/workflows', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spec-ledger-token': token }, body: JSON.stringify(next), signal: AbortSignal.timeout(15000) }))
      sessionStorage.removeItem(storageKey); setPending(undefined)
      return true
    } catch (error) {
      const failure = error as Error & { rejected?: boolean; code?: string }
      if (failure.rejected && !['execution_unknown', 'operation_busy'].includes(failure.code ?? '')) {
        sessionStorage.removeItem(storageKey); setPending(undefined)
      }
      setMessage(failure.message)
      return false
    } finally { setBusy(false) }
  }
  return { pending, busy, message, run }
}
