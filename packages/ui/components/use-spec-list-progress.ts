"use client"

import { useEffect, useState } from "react"
import type { SpecListProgress, SpecListRow } from "@/lib/workstream-list"

/** One observation at a time keeps background work bounded and navigation free. */
export async function observeListProgress(ids: string[], signal: AbortSignal, receive: (id: string, progress: SpecListProgress | null) => void) {
  for (const id of ids) {
    if (signal.aborted) return
    const controller = new AbortController()
    const cancel = () => controller.abort()
    signal.addEventListener("abort", cancel, { once: true })
    const timeout = setTimeout(cancel, 8000)
    try {
      const response = await fetch(`/api/spec-progress?workstream=${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal })
      if (!response.ok) throw new Error("Progress unavailable")
      const result = await response.json()
      if (!signal.aborted) receive(id, result.workstreamId === id ? result.progress ?? null : null)
    } catch {
      if (!signal.aborted) receive(id, null)
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener("abort", cancel)
    }
  }
}

export function useSpecListProgress(rows: SpecListRow[], snapshot: string) {
  const ids = rows.filter(row => row.workstream.status !== "cancelled").map(row => row.workstream.id)
  const key = JSON.stringify([snapshot, ids])
  const [observation, setObservation] = useState<{ key: string; values: Record<string, SpecListProgress | null> }>({ key: "", values: {} })
  useEffect(() => {
    const controller = new AbortController()
    const [, selected] = JSON.parse(key) as [string, string[]]
    void observeListProgress(selected, controller.signal, (id, progress) => {
      setObservation(previous => ({ key, values: { ...(previous.key === key ? previous.values : {}), [id]: progress } }))
    })
    return () => controller.abort()
  }, [key])
  return observation.key === key ? observation.values : {}
}
