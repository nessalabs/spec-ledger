"use client"

import { useEffect, useRef, useState } from "react"
import type { SessionProjection } from "@nessalabs/spec-ledger-client"

export type SessionConnectionState = "connected" | "loading" | "disconnected"

const POLL_MS = 5000
const REQUEST_TIMEOUT_MS = 8000

/** Observe one session projection while retaining the last successful response. */
export function useSessionObservation(
  initial: SessionProjection,
  workstreamId?: string,
) {
  const [data, setData] = useState(initial)
  const [state, setState] = useState<SessionConnectionState>("connected")
  const [observed, setObserved] = useState("")
  const observationEpoch = useRef(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let controller: AbortController | undefined

    function schedule(delay: number) {
      clearTimeout(timer)
      if (!cancelled) timer = setTimeout(observe, delay)
    }

    async function observe() {
      // A hidden tab cannot show the result, so wait for it to come back
      // rather than polling the ledger forever in the background.
      if (document.hidden) return
      const epoch = observationEpoch.current
      controller = new AbortController()
      const timeout = setTimeout(() => controller?.abort(), REQUEST_TIMEOUT_MS)
      try {
        const query = workstreamId
          ? `?workstream=${encodeURIComponent(workstreamId)}`
          : ""
        const response = await fetch(`/api/session${query}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Observation failed")
        const next: SessionProjection = await response.json()
        if (!cancelled && epoch === observationEpoch.current) {
          setData(next)
          setState("connected")
          setObserved(new Date(next.observedAt).toLocaleTimeString())
        }
      } catch {
        if (!cancelled && epoch === observationEpoch.current) {
          setState("disconnected")
        }
      } finally {
        clearTimeout(timeout)
        schedule(POLL_MS)
      }
    }

    // Resume immediately when the tab is shown again, so a returning reader
    // never waits a full interval for current data.
    const onVisible = () => { if (!document.hidden) schedule(0) }
    document.addEventListener("visibilitychange", onVisible)

    setState("loading")
    void observe()
    return () => {
      cancelled = true
      clearTimeout(timer)
      controller?.abort()
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [workstreamId])

  function replaceData(next: SessionProjection) {
    observationEpoch.current++
    setData(next)
    setState("connected")
    setObserved(new Date(next.observedAt).toLocaleTimeString())
  }

  function invalidateObservation() {
    observationEpoch.current++
  }

  return { data, state, observed, replaceData, invalidateObservation }
}
