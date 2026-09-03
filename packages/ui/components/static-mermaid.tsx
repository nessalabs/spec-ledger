"use client"

import nextDynamic from "next/dynamic"

/**
 * Mermaid is heavy — load only when a turn/flow actually needs a chart.
 * Prefer this over importing mermaid from RSC trees.
 */
export const StaticMermaid = nextDynamic(
  () => import("./static-mermaid-inner").then((m) => m.StaticMermaidInner),
  {
    ssr: false,
    loading: () => (
      <div aria-hidden className="min-h-32 animate-pulse rounded-md bg-muted/40" />
    ),
  },
)
