"use client"

import { useEffect, useState, type ReactNode } from "react"
import { specSectionForHash, type SpecSection } from "@/lib/spec-sections"

/** Ordinary links keep keyboard navigation and browser history native. */
export function SpecSections({ evidence, changes, process, title }: { evidence: ReactNode; changes: ReactNode; process: ReactNode; title?: string }) {
  const [selected, setSelected] = useState<SpecSection>("evidence")
  useEffect(() => {
    const sync = () => setSelected(specSectionForHash(window.location.hash))
    sync()
    window.addEventListener("hashchange", sync)
    window.addEventListener("popstate", sync)
    return () => { window.removeEventListener("hashchange", sync); window.removeEventListener("popstate", sync) }
  }, [])
  useEffect(() => {
    if (!window.location.hash) return
    const target = document.getElementById(window.location.hash.slice(1))
    target?.scrollIntoView({ block: "nearest" })
  }, [selected])
  return <div className="min-w-0 space-y-5">
    <div className="sticky -top-6 z-10 space-y-2 border-b border-border bg-background py-3">
      {title && <p className="truncate text-sm font-medium" title={title}>{title}</p>}
      <nav aria-label="Spec sections" className="grid grid-cols-3 gap-1 sm:flex sm:gap-2">
      {([['evidence', 'Evidence'], ['changes', 'Changes'], ['process', 'Process details']] as const).map(([id, label]) => <a key={id} href={`#${id}`} aria-current={selected === id ? "location" : undefined} className={`rounded-lg px-2 py-2 text-center text-xs sm:px-4 sm:text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${selected === id ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{label}</a>)}
      </nav>
    </div>
    <section id="evidence" hidden={selected !== "evidence"} aria-label="Spec evidence">{evidence}</section>
    <section id="changes" hidden={selected !== "changes"} aria-label="Spec changes">{changes}</section>
    <section id="process" hidden={selected !== "process"} aria-label="Spec process details">{process}</section>
  </div>
}
