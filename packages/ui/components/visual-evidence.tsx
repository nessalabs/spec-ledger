'use client'

import { useRef, useState } from 'react'

export function VisualEvidence({ src, title, note }: { src: string; title: string; note?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [failed, setFailed] = useState(false)
  return <figure className="space-y-2 rounded-xl border border-border p-3">
    {failed ? <p role="status">Saved image could not be displayed.</p> : <button type="button" className="block w-full cursor-zoom-in rounded-lg bg-muted/30" aria-label={`Enlarge ${title}`} onClick={() => dialog.current?.showModal()}>
      {/* Already bounded and integrity checked by the client projection. */}
      <img src={src} alt={title} onError={() => setFailed(true)} className="mx-auto max-h-64 max-w-full object-contain" />
    </button>}
    <figcaption className="text-sm"><p className="font-medium">{title}</p><p className="text-xs text-muted-foreground">Saved visual observation · integrity checked</p>{note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}</figcaption>
    <dialog ref={dialog} aria-label={title} className="m-auto max-h-[95vh] max-w-[95vw] overflow-auto rounded-xl border border-border bg-background p-4 text-foreground backdrop:bg-black/60" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <div className="sticky top-0 flex justify-end bg-background pb-2"><button type="button" autoFocus className="rounded border border-border px-3 py-1 text-sm" onClick={() => dialog.current?.close()}>Close image</button></div>
      <img src={src} alt={title} className="max-w-full" />
    </dialog>
  </figure>
}
