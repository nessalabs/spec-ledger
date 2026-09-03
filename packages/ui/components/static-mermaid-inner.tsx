"use client"

import * as React from "react"
import mermaid from "mermaid"

let initialized = false

function ensureMermaid() {
  if (initialized) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "dark",
    flowchart: { htmlLabels: false },
  })
  initialized = true
}

/** Actual Mermaid render — imported only via dynamic() from static-mermaid.tsx. */
export function StaticMermaidInner({
  chart,
  className,
}: {
  chart: string
  className?: string
}) {
  const [svg, setSvg] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState(false)
  const id = React.useId().replace(/:/g, "")

  React.useEffect(() => {
    let cancelled = false
    setFailed(false)
    ensureMermaid()
    const renderId = `lattice-mmd-${id}`
    mermaid
      .render(renderId, chart)
      .then((result) => {
        if (!cancelled) setSvg(result.svg)
      })
      .catch(() => {
        if (!cancelled) {
          setSvg(null)
          setFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [chart, id])

  if (failed) {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
        {chart}
      </pre>
    )
  }

  if (!svg) {
    return <div className={className} aria-hidden style={{ minHeight: "8rem" }} />
  }

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: svg }} />
  )
}
