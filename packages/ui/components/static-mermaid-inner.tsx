"use client"

import * as React from "react"
import mermaid from "mermaid"

type MermaidTheme = "dark" | "default"

const documentTheme = (): MermaidTheme =>
  document.documentElement.classList.contains("dark") ? "dark" : "default"

/** Re-render diagrams when the reader switches between light and dark. */
function useDocumentTheme() {
  const [theme, setTheme] = React.useState(documentTheme)
  React.useEffect(() => {
    const observer = new MutationObserver(() => setTheme(documentTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])
  return theme
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
  const theme = useDocumentTheme()

  React.useEffect(() => {
    let cancelled = false
    setFailed(false)
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme,
      flowchart: { htmlLabels: false },
    })
    mermaid
      .render(`spec-ledger-mmd-${id}`, chart)
      .then(result => {
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
  }, [chart, id, theme])

  if (failed) {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
        {chart}
      </pre>
    )
  }

  if (!svg) {
    return (
      <div
        aria-hidden
        className="min-h-32 animate-pulse rounded-md bg-muted/40"
      />
    )
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}
