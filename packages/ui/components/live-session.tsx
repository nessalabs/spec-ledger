"use client"

import { ReadableText } from "@/components/readable-text"

import { useRef, useState } from "react"
import Link from "next/link"
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@nessalabs/ui"
import { ChevronDown } from "lucide-react"
import type { SessionProjection } from "@nessalabs/spec-ledger-client"
import { completionLabel } from "@/lib/turn-evidence"
import { presentationCopy } from "@/lib/features"
import { AcceptanceProgress } from "@/components/acceptance-progress"
import { useSessionObservation } from "@/components/use-session-observation"

const CLOSED = ["done", "cancelled"]

function connectionLabel(state: string, observed: string) {
  const base =
    state === "disconnected"
      ? "Disconnected · showing last observation"
      : state === "loading"
        ? "Refreshing…"
        : "Connected"
  return observed ? `${base} · ${observed}` : base
}

export function LiveSession({ initial }: { initial: SessionProjection }) {
  const [selected, setSelected] = useState(initial.session?.workstreamId ?? "")
  const [saving, setSaving] = useState(false)
  const [decisionMessage, setDecisionMessage] = useState("")
  const pendingDecision = useRef<{ key: string; requestId: string } | null>(null)
  const { data, state, observed, replaceData, invalidateObservation } =
    useSessionObservation(initial, selected || undefined)

  // Ignore a projection that still describes the previously selected spec.
  const session =
    selected && data.session?.workstreamId !== selected ? null : data.session
  const extraAttention =
    session?.attention.filter(item => !session.completion.reasons.includes(item)) ?? []

  async function decide(action: "approve" | "deny") {
    if (!session || saving) return
    invalidateObservation()
    setSaving(true)
    setDecisionMessage("")
    const key = `${action}/${session.workstreamId}/${session.revisionDigest}/${session.authorityDigest}`
    if (pendingDecision.current?.key !== key) {
      pendingDecision.current = { key, requestId: crypto.randomUUID() }
    }
    try {
      const tokenResponse = await fetch("/api/approval", {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      })
      if (!tokenResponse.ok) throw new Error("Local approval is unavailable.")
      const { token } = await tokenResponse.json()

      const response = await fetch("/api/approval", {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json", "X-Spec-Ledger-Token": token },
        body: JSON.stringify({
          action,
          workstreamId: session.workstreamId,
          revisionDigest: session.revisionDigest,
          authorityDigest: session.authorityDigest,
          requestId: pendingDecision.current.requestId,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.saved) {
        throw new Error(result.error ?? "Decision could not be saved.")
      }

      const observation = await fetch(
        `/api/session?workstream=${encodeURIComponent(session.workstreamId)}`,
        { cache: "no-store", signal: AbortSignal.timeout(8000) },
      )
      if (!observation.ok) {
        throw new Error("Decision saved, but the current state could not be refreshed.")
      }
      const next: SessionProjection = await observation.json()
      replaceData(next)
      const settled =
        action === "approve"
          ? next.session?.permission.allowed
          : !next.session?.permission.allowed
      setDecisionMessage(
        settled
          ? action === "approve"
            ? "Approval saved."
            : "Denial saved."
          : "Decision saved. The current state has changed; review it before continuing.",
      )
      pendingDecision.current = null
    } catch (error) {
      setDecisionMessage(
        error instanceof Error ? error.message : "Decision could not be saved.",
      )
    } finally {
      invalidateObservation()
      setSaving(false)
    }
  }

  function choose(id: string) {
    setSelected(id)
    setDecisionMessage("")
    const url = new URL(window.location.href)
    url.searchParams.set("workstream", id)
    window.history.replaceState(null, "", url)
  }

  return (
    <section className="space-y-4" aria-label="Current work">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Current work</h2>
        <span role="status" className="text-sm text-muted-foreground">
          {connectionLabel(state, observed)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span id="session-label">Following</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={saving}
              variant="outline"
              className="max-w-full"
              aria-labelledby="session-label session-value"
            >
              <span id="session-value" className="truncate">
                {data.choices.find(w => w.id === selected)?.title ??
                  session?.title ??
                  "Choose a spec"}
              </span>
              <ChevronDown className="ml-2 size-4 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-w-[calc(100vw-5rem)]">
            <DropdownMenuRadioGroup value={selected} onValueChange={choose}>
              {data.choices.map(w => (
                <DropdownMenuRadioItem key={w.id} value={w.id}>
                  <ReadableText>{w.title}</ReadableText>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!session ? (
        <p className="text-muted-foreground">
          {data.selectionRequired
            ? "Several workstreams are available. Choose the one you want to follow."
            : "No active workstream yet. Start with a plan."}
        </p>
      ) : (
        <>
          <div className="space-y-3 rounded-xl border border-border p-5">
            <Link
              className="text-xl font-semibold hover:underline"
              href={`/workstreams/${session.workstreamId}`}
            >
              <ReadableText>{presentationCopy(session.title)}</ReadableText>
            </Link>
            <p><ReadableText>{presentationCopy(session.goal)}</ReadableText></p>
            <p className="text-sm text-muted-foreground">
              {completionLabel(session.status, session.completion.eligible) ??
                (session.permission.allowed
                  ? "Approved to proceed"
                  : "Needs your decision")}
            </p>

            <nav
              aria-label="Selected work"
              className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
            >
              <Link className="underline" href={`/workstreams/${session.workstreamId}`}>
                Read spec
              </Link>
              <Link
                className="underline"
                href={`/workstreams/${session.workstreamId}#evidence`}
              >
                View evidence
              </Link>
              <Link
                className="underline"
                href={`/workstreams/${session.workstreamId}#changes`}
              >
                Changes
              </Link>
              <Link className="underline" href={`/workstreams/${session.workstreamId}#workflow`}>
                Workflow
              </Link>
            </nav>

            <details className="text-xs text-muted-foreground">
              <summary>Approval details</summary>
              <p>Revision {session.revision ?? "not yet sealed"}</p>
              <p>
                {session.permission.mode ?? "No permission recorded"} ·{" "}
                {session.permission.provenance}
              </p>
              {session.permission.reasons.map(reason => (
                <p key={reason}><ReadableText>{reason}</ReadableText></p>
              ))}
            </details>

            {!session.permission.allowed && !CLOSED.includes(session.status) ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={saving || state !== "connected"}
                    onClick={() => void decide("approve")}
                  >
                    {saving ? "Saving…" : "Approve this revision"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={saving || state !== "connected"}
                    onClick={() => void decide("deny")}
                  >
                    Deny
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Approving this revision replaces any previous denial for this workstream.
                </p>
              </div>
            ) : null}

            {decisionMessage ? (
              <p role="status" className="text-sm">
                {decisionMessage}
              </p>
            ) : null}
          </div>

          <AcceptanceProgress
            total={session.criteria.length}
            verified={session.evidenceCount}
            implemented={session.criteria.filter(criterion => criterion.implemented).length}
            remaining={session.completion.reasons}
            checklist={session.completion.checklist}
            completionEligible={session.completion.eligible}
            historical={session.status === "done"}
            unmapped={session.criteria.filter(c => !c.claims.length).length}
          />

          {extraAttention.length > 0 ? (
            <section className="space-y-2">
              <h3 className="font-semibold">Needs attention</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {extraAttention.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="font-semibold">Recent updates</h3>
            <Link
              className="text-sm underline"
              href={`/workstreams/${session.workstreamId}#updates`}
            >
              All updates
            </Link>
            {session.activity.length ? (
              <ul className="space-y-3">
                {session.activity.slice(0, 3).map(item => (
                  <li key={item.id} className="rounded-lg border border-border p-3 text-sm">
                    <p><ReadableText>{item.summary}</ReadableText></p>
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary>Context</summary>
                      <p><ReadableText>{item.reason}</ReadableText></p>
                      {item.discovery ? (
                        <p>
                          {item.discovery.kind}: <ReadableText>{item.discovery.observation}</ReadableText>
                        </p>
                      ) : null}
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
            )}
          </section>

          {session.preview ? (
            <section className="space-y-2">
              <h3 className="font-semibold">Try it</h3>
              <a
                href={session.preview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                <ReadableText>{session.preview.label}</ReadableText>
              </a>
              <p className="text-xs text-muted-foreground">
                Reported for this source revision. Availability has not been checked.
              </p>
            </section>
          ) : null}
        </>
      )}
    </section>
  )
}
