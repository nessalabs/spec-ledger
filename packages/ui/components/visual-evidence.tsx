"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Expand } from "lucide-react"
import { Button, WindowDeck, WindowDeckPane } from "@nessalabs/ui"
import type { SessionProjection } from "@nessalabs/spec-ledger-client"
import { ReadableText, useRecordLabels } from "@/components/readable-text"
import { readableText } from "@/lib/record-labels"

type Session = NonNullable<SessionProjection["session"]>
type Artifact = Session["artifacts"][number]

function Screenshot({ artifact, title }: { artifact: Artifact; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [failed, setFailed] = useState(false)
  if (!artifact.imageDataUrl || failed) return <div role="status" className="flex h-full min-h-48 items-center justify-center p-6 text-center text-sm text-muted-foreground">
    <p>Preview unavailable. The recording details are still available below.</p>
  </div>
  return <>
    <button type="button" className="group relative flex h-full w-full cursor-zoom-in items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`Enlarge ${title}`} onClick={() => dialog.current?.showModal()}>
      <img src={artifact.imageDataUrl} alt={title} draggable={false} onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />
      <span className="absolute right-3 bottom-3 rounded-md border border-border bg-background/90 p-2" aria-hidden="true"><Expand className="size-4" /></span>
    </button>
    <dialog ref={dialog} aria-label={title} className="m-auto max-h-[95vh] max-w-[95vw] overflow-auto rounded-xl border border-border bg-background p-4 text-foreground backdrop:bg-black/60" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <div className="sticky top-0 flex justify-end bg-background pb-2"><button type="button" autoFocus className="rounded border border-border px-3 py-1 text-sm" onClick={() => dialog.current?.close()}>Close image</button></div>
      <img src={artifact.imageDataUrl} alt={title} className="max-w-full" />
    </dialog>
  </>
}

/** Selection owns both the window and the evidence beneath it, including after refresh. */
export function VisualEvidence({ artifacts, coverage }: { artifacts: Session["artifacts"]; coverage: Session["visualEvidence"] }) {
  const labels = useRecordLabels()
  const [showEarlier, setShowEarlier] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const currentIds = new Set(coverage?.surfaces.filter(surface => surface.satisfied).map(surface => surface.attachmentId))
  const images = artifacts.filter(artifact => artifact.mediaType?.startsWith("image/"))
  const current = images.filter(artifact => currentIds.has(artifact.id))
  const earlier = images.filter(artifact => !currentIds.has(artifact.id))
  const viewingEarlier = current.length === 0 || (showEarlier && earlier.length > 0)
  const visible = viewingEarlier ? earlier : current
  const selected = visible.find(artifact => artifact.id === selectedId) ?? visible[0]
  if (!selected) return null
  const index = visible.indexOf(selected)
  const title = readableText(selected.title, labels)
  const move = (offset: number) => setSelectedId(visible[Math.max(0, Math.min(visible.length - 1, index + offset))].id)
  const captured = selected.recordedAt && !Number.isNaN(Date.parse(selected.recordedAt))
    ? `${new Date(selected.recordedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`
    : "Capture date not recorded"

  return <section aria-label="Visual evidence" className="min-w-0 space-y-4" onKeyDown={event => {
    if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey || event.target instanceof HTMLElement && event.target.closest("dialog, input, textarea, select, [contenteditable=true]")) return
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1) }
  }}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-medium">Visual evidence</h3>
      <div className="flex flex-wrap gap-2" aria-label="Screenshot collections">
        <Button type="button" size="sm" variant={!viewingEarlier ? "secondary" : "ghost"} aria-pressed={!viewingEarlier} disabled={!current.length} onClick={() => setShowEarlier(false)}>Current screenshots ({current.length})</Button>
        {earlier.length > 0 && <Button type="button" size="sm" variant={viewingEarlier ? "secondary" : "ghost"} aria-pressed={viewingEarlier} onClick={() => setShowEarlier(true)}>Earlier screenshots ({earlier.length})</Button>}
      </div>
    </div>
    {viewingEarlier && <p className="text-sm text-muted-foreground">These earlier captures are preserved for reference. They are not used for current screenshot coverage.</p>}
    <WindowDeck activePane={selected.id} onActivePaneChange={setSelectedId} mode="carousel" paneWidth="92cqw" paneHeight="100%" contentMount="active" wheelNavigation={false} shortcuts={{ toggleOverview: false, dismissPane: false }} aria-label="Screenshot viewer" className="h-[clamp(16rem,42vw,30rem)] w-full rounded-xl bg-muted/20">
      {visible.map(artifact => <WindowDeckPane key={artifact.id} id={artifact.id} label={readableText(artifact.title, labels)} scrollable={false} dismissible={false} contentClassName="p-2">
        <Screenshot key={artifact.id} artifact={artifact} title={readableText(artifact.title, labels)} />
      </WindowDeckPane>)}
    </WindowDeck>
    <div className="flex items-center justify-between gap-3">
      <Button type="button" variant="outline" size="sm" aria-label="Previous screenshot" disabled={index === 0} onClick={() => move(-1)}><ArrowLeft className="size-4" aria-hidden="true" /><span>Previous</span></Button>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{index + 1} of {visible.length}</p>
      <Button type="button" variant="outline" size="sm" aria-label="Next screenshot" disabled={index === visible.length - 1} onClick={() => move(1)}><span>Next</span><ArrowRight className="size-4" aria-hidden="true" /></Button>
    </div>
    <div aria-label="Selected screenshot evidence" className="space-y-2 border-t border-border pt-4 text-sm">
      <h4 className="font-medium"><ReadableText>{title}</ReadableText></h4>
      <p className={viewingEarlier ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400"}>{viewingEarlier ? "Earlier capture · not counted toward current coverage" : "Current screenshot coverage"}</p>
      <p className="text-xs text-muted-foreground">{captured} · {selected.status === "verified" ? "Image integrity checked" : "Preview unavailable"}</p>
      {selected.note && <p className="text-muted-foreground"><ReadableText>{selected.note}</ReadableText></p>}
      {selected.status !== "verified" && <p className="text-muted-foreground"><ReadableText>{selected.reason}</ReadableText></p>}
      <p className="text-xs text-muted-foreground">A screenshot documents appearance. Passing behavioral checks are shown separately below.</p>
      <Link href={`/turns/${selected.turnId}`} className="inline-block underline underline-offset-4">Open recording change</Link>
    </div>
  </section>
}
