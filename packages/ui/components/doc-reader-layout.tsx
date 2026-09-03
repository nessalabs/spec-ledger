"use client"

import * as React from "react"
import { X } from "lucide-react"
import {
  CodeBlockProvider,
  MessageMarkdown,
  SplitView,
  SplitViewPanel,
  SplitViewSeparator,
} from "@nessa-ui/react"
import { cn } from "@/lib/cn"
import { resolveRepoDocPath } from "@/lib/repo-doc-path"
import type { DocTab } from "@/components/doc-reader"

type OpenDoc = (doc: {
  path: string
  label?: string
  content?: string | null
}) => void

/**
 * Split + MessageMarkdown live in this chunk so the shell stays light until
 * the user actually opens a reader tab.
 */
export function DocReaderLayout({
  tabs,
  activePath,
  onSelect,
  onCloseTab,
  onCloseAll,
  onOpenDoc,
  children,
}: {
  tabs: DocTab[]
  activePath: string
  onSelect: (path: string) => void
  onCloseTab: (path: string) => void
  onCloseAll: () => void
  onOpenDoc: OpenDoc
  children: React.ReactNode
}) {
  const active = tabs.find((t) => t.path === activePath) ?? tabs[0]!

  const components = React.useMemo(
    () => ({
      a: function DocLink({
        href,
        children,
        ...rest
      }: React.ComponentProps<"a">) {
        const repoPath = href ? resolveRepoDocPath(active.path, href) : null
        if (repoPath) {
          return (
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-primary underline underline-offset-4"
              title={`Open ${repoPath} in reader`}
              onClick={(e) => {
                e.preventDefault()
                onOpenDoc({
                  path: repoPath,
                  label: repoPath.split("/").pop() ?? repoPath,
                })
              }}
            >
              {children}
            </button>
          )
        }
        return (
          <a href={href} {...rest}>
            {children}
          </a>
        )
      },
    }),
    [active.path, onOpenDoc],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SplitView
        className="min-h-0 flex-1"
        defaultLayout={{ main: 55, doc: 45 }}
      >
        <SplitViewPanel id="main" minSize="280px" className="min-h-0">
          <div className="h-full min-h-0 overflow-y-auto overscroll-contain p-6">
            {children}
          </div>
        </SplitViewPanel>
        <SplitViewSeparator />
        <SplitViewPanel id="doc" minSize="260px" className="min-h-0">
          <div
            data-slot="doc-reader"
            className="flex h-full min-h-0 flex-col border-l border-border bg-card"
          >
            <div className="flex shrink-0 items-stretch gap-0 border-b border-border">
              <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
                {tabs.map((t) => {
                  const selected = t.path === active.path
                  return (
                    <div
                      key={t.path}
                      className={cn(
                        "group/tab flex max-w-[12rem] shrink-0 items-center gap-1 border-r border-border px-2 py-1.5",
                        selected
                          ? "bg-background"
                          : "bg-muted/30 hover:bg-muted/50",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(t.path)}
                        title={t.path}
                        className={cn(
                          "min-w-0 flex-1 truncate text-left text-xs",
                          selected
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {t.label}
                      </button>
                      <button
                        type="button"
                        onClick={() => onCloseTab(t.path)}
                        aria-label={`Close ${t.label}`}
                        className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-60 hover:bg-accent hover:opacity-100 group-hover/tab:opacity-100"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={onCloseAll}
                aria-label="Close reader"
                className="inline-flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="border-b border-border px-3 py-1.5">
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {active.path}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              <CodeBlockProvider mode="dark">
                <MessageMarkdown
                  className="text-sm leading-relaxed"
                  components={components}
                >
                  {active.content}
                </MessageMarkdown>
              </CodeBlockProvider>
            </div>
          </div>
        </SplitViewPanel>
      </SplitView>
    </div>
  )
}
