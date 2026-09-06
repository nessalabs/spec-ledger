"use client"

import { useRecordLabels } from "@/components/readable-text"
import { readableText, readableMarkdown } from "@/lib/record-labels"

import { presentationCopy } from "@/lib/features"

import Link from "next/link"
import * as React from "react"
import { useDocPane } from "@/components/doc-reader"

/** ⌘/Ctrl-click opens a markdown peek tab in the shell reader; plain click navigates. */
export function PeekLink({
  href,
  peekPath,
  peekLabel,
  peekContent,
  className,
  title,
  children,
}: {
  href: string
  peekPath: string
  peekLabel: string
  peekContent: string
  className?: string
  title?: string
  children: React.ReactNode
}) {
  const { openDoc } = useDocPane()
  const labels = useRecordLabels()

  return (
    <Link
      href={href}
      className={className}
      title={readableText(title, labels)}
      onClick={(e) => {
        if (!(e.metaKey || e.ctrlKey)) return
        e.preventDefault()
        openDoc({
          path: peekPath,
          label: readableText(peekLabel, labels),
          content: readableMarkdown(peekContent, labels),
        })
      }}
    >
      {children}
    </Link>
  )
}

export function turnPeekMarkdown(args: {
  id: string
  labels?: Record<string, string>
  goal: string
  workstreamId?: string | null
  workstreamTitle?: string | null
  status: string
  when?: string | null
  areas?: string
  fileBit?: string
}): string {
  const lines = [
    `# ${presentationCopy(args.goal)}`,
    "",
    `${args.status}${args.when ? ` · ${args.when}` : ""}`,
  ]
  if (args.workstreamId) {
    lines.push(
      "",
      `Spec: ${readableText(presentationCopy(args.workstreamTitle ?? "Related spec"), args.labels)}`,
    )
  }
  if (args.areas || args.fileBit) {
    lines.push(
      "",
      "## Impact",
      "",
      [args.areas, args.fileBit].filter(Boolean).join(" · "),
    )
  }
  lines.push(
    "",
    `[Open full turn](/turns/${encodeURIComponent(args.id)})`,
    "",
  )
  return readableMarkdown(lines.join("\n"), args.labels ?? {})
}

export function claimPeekMarkdown(args: {
  id: string
  labels?: Record<string, string>
  statement: string
  kind: string
  required: boolean
  outcome?: string
  bindings: number
  detail?: string
}): string {
  const lines = [
    `# ${readableText(args.statement, args.labels)}`,
    "",
    readableText(args.statement, args.labels),
    "",
    `**${args.kind}** · ${args.required ? "required" : "optional"} · ${args.bindings} binding${
      args.bindings === 1 ? "" : "s"
    }${args.outcome ? ` · verify **${args.outcome}**` : ""}`,
  ]
  if (readableText(args.detail, args.labels)) {
    lines.push("", "## Verify detail", "", readableText(args.detail, args.labels))
  }
  lines.push(
    "",
    `[Open full claim](/claims/${encodeURIComponent(args.id)})`,
    "",
  )
  return readableMarkdown(lines.join("\n"), args.labels ?? {})
}

export function workstreamPeekMarkdown(args: {
  id: string
  labels?: Record<string, string>
  title: string
  objective: string
  status: string
  revision?: number
}): string {
  return readableMarkdown([
    `# ${presentationCopy(args.title)}`,
    "",
    `${args.status}${
      args.revision != null ? ` · rev ${args.revision}` : ""
    }`,
    "",
    presentationCopy(args.objective),
    "",
    `[Open full workstream](/workstreams/${encodeURIComponent(args.id)})`,
    "",
  ].join("\n"), args.labels ?? {})
}
