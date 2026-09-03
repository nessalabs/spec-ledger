"use client"

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

  return (
    <Link
      href={href}
      className={className}
      title={title}
      onClick={(e) => {
        if (!(e.metaKey || e.ctrlKey)) return
        e.preventDefault()
        openDoc({
          path: peekPath,
          label: peekLabel,
          content: peekContent,
        })
      }}
    >
      {children}
    </Link>
  )
}

export function turnPeekMarkdown(args: {
  id: string
  goal: string
  workstreamId?: string | null
  workstreamTitle?: string | null
  status: string
  when?: string | null
  areas?: string
  fileBit?: string
}): string {
  const lines = [
    `# ${args.goal}`,
    "",
    `**${args.id}** · ${args.status}${args.when ? ` · ${args.when}` : ""}`,
  ]
  if (args.workstreamId) {
    lines.push(
      "",
      `Workstream **${args.workstreamId}**${
        args.workstreamTitle ? ` — ${args.workstreamTitle}` : ""
      }`,
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
  return lines.join("\n")
}

export function claimPeekMarkdown(args: {
  id: string
  statement: string
  kind: string
  required: boolean
  outcome?: string
  bindings: number
  detail?: string
}): string {
  const lines = [
    `# ${args.id}`,
    "",
    args.statement,
    "",
    `**${args.kind}** · ${args.required ? "required" : "optional"} · ${args.bindings} binding${
      args.bindings === 1 ? "" : "s"
    }${args.outcome ? ` · verify **${args.outcome}**` : ""}`,
  ]
  if (args.detail) {
    lines.push("", "## Verify detail", "", args.detail)
  }
  lines.push(
    "",
    `[Open full claim](/claims/${encodeURIComponent(args.id)})`,
    "",
  )
  return lines.join("\n")
}

export function workstreamPeekMarkdown(args: {
  id: string
  title: string
  objective: string
  status: string
  revision?: number
}): string {
  return [
    `# ${args.title}`,
    "",
    `**${args.id}** · ${args.status}${
      args.revision != null ? ` · rev ${args.revision}` : ""
    }`,
    "",
    args.objective,
    "",
    `[Open full workstream](/workstreams/${encodeURIComponent(args.id)})`,
    "",
  ].join("\n")
}
