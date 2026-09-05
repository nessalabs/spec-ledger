"use client"

import { useEffect, useRef, useState } from "react"
import type { SessionProjection } from "@nessalabs/spec-ledger-client"

export type SessionConnectionState = "connected" | "loading" | "disconnected"

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

    async function observe() {
      const epoch = observationEpoch.current
      controller = new AbortController()
      const timeout = setTimeout(() => controller?.abort(), 8000)
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
        if (!cancelled) timer = setTimeout(observe, 5000)
      }
    }

    setState("loading")
    void observe()
    return () => {
      cancelled = true
      clearTimeout(timer)
      controller?.abort()
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

  return {
    data,
    state,
    observed,
    replaceData,
    invalidateObservation,
  }
}
