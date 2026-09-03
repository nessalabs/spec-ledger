"use client"

import { MessageMarkdown } from "@nessa-ui/react"

/** Workstream / vision Markdown via Nessa MessageMarkdown (GFM + code). */
export function SpecDoc({
  markdown,
  path,
}: {
  markdown: string
  path?: string
}) {
  return (
    <div className="space-y-3 text-sm">
      {path ? (
        <p className="font-mono text-[11px] text-muted-foreground">{path}</p>
      ) : null}
      <MessageMarkdown className="nessa-text-4 text-sm leading-relaxed">
        {markdown}
      </MessageMarkdown>
    </div>
  )
}
