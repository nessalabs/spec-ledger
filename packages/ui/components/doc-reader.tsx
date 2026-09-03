"use client"

import * as React from "react"
import { X } from "lucide-react"
import {
  MessageMarkdown,
  SplitView,
  SplitViewPanel,
  SplitViewSeparator,
} from "@nessa-ui/react"
import { cn } from "@/lib/cn"

export type DocTab = {
  path: string
  label: string
  content: string
}

type DocReaderContextValue = {
  /** Open or focus a markdown tab in the shell reader (persists across routes). */
  openDoc: (doc: {
    path: string
    label?: string
    content?: string | null
  }) => void
  closeTab: (path: string) => void
  closeReader: () => void
  /** Cache docs so Read can open by path after register. */
  registerDocs: (
    docs: Array<{ path: string; label: string; content?: string | null }>,
  ) => void
  tabs: DocTab[]
  activePath: string | null
  /** Alias for activePath — matches older useDocPane callers. */
  openPath: string | null
}

const DocReaderContext = React.createContext<DocReaderContextValue | null>(null)

export function useDocPane(): DocReaderContextValue {
  const ctx = React.useContext(DocReaderContext)
  if (!ctx) {
    return {
      openDoc: () => {},
      closeTab: () => {},
      closeReader: () => {},
      registerDocs: () => {},
      tabs: [],
      activePath: null,
      openPath: null,
    }
  }
  return ctx
}

/** @deprecated use useDocPane */
export const useDocReader = useDocPane

async function fetchRepoText(path: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/repo-file?path=${encodeURIComponent(path)}`)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export function DocReaderProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = React.useState<DocTab[]>([])
  const [activePath, setActivePath] = React.useState<string | null>(null)
  const cacheRef = React.useRef(
    new Map<string, { label: string; content: string }>(),
  )

  const registerDocs = React.useCallback(
    (
      docs: Array<{ path: string; label: string; content?: string | null }>,
    ) => {
      for (const d of docs) {
        if (!d.content) continue
        cacheRef.current.set(d.path, { label: d.label, content: d.content })
      }
    },
    [],
  )

  const openDoc = React.useCallback(
    (doc: { path: string; label?: string; content?: string | null }) => {
      const cached = cacheRef.current.get(doc.path)
      const label = doc.label ?? cached?.label ?? doc.path.split("/").pop() ?? doc.path
      const known = doc.content ?? cached?.content

      const focusOrAdd = (content: string) => {
        cacheRef.current.set(doc.path, { label, content })
        setTabs((prev) => {
          if (prev.some((t) => t.path === doc.path)) return prev
          return [...prev, { path: doc.path, label, content }]
        })
        setActivePath(doc.path)
      }

      if (known) {
        focusOrAdd(known)
        return
      }

      void fetchRepoText(doc.path).then((text) => {
        if (!text) return
        focusOrAdd(text)
      })
    },
    [],
  )

  const closeTab = React.useCallback((path: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.path !== path)
      setActivePath((cur) => {
        if (cur !== path) return cur
        return next[next.length - 1]?.path ?? null
      })
      return next
    })
  }, [])

  const closeReader = React.useCallback(() => {
    setTabs([])
    setActivePath(null)
  }, [])

  const value = React.useMemo<DocReaderContextValue>(
    () => ({
      openDoc,
      closeTab,
      closeReader,
      registerDocs,
      tabs,
      activePath,
      openPath: activePath,
    }),
    [openDoc, closeTab, closeReader, registerDocs, tabs, activePath],
  )

  const active = tabs.find((t) => t.path === activePath) ?? tabs[0] ?? null
  const open = tabs.length > 0 && active

  return (
    <DocReaderContext.Provider value={value}>
      {open ? (
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
              <DocReaderPane
                tabs={tabs}
                activePath={active.path}
                onSelect={setActivePath}
                onCloseTab={closeTab}
                onCloseAll={closeReader}
              />
            </SplitViewPanel>
          </SplitView>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
          {children}
        </div>
      )}
    </DocReaderContext.Provider>
  )
}

function DocReaderPane({
  tabs,
  activePath,
  onSelect,
  onCloseTab,
  onCloseAll,
}: {
  tabs: DocTab[]
  activePath: string
  onSelect: (path: string) => void
  onCloseTab: (path: string) => void
  onCloseAll: () => void
}) {
  const active = tabs.find((t) => t.path === activePath) ?? tabs[0]!

  return (
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
                  selected ? "bg-background" : "bg-muted/30 hover:bg-muted/50",
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
        <MessageMarkdown className="text-sm leading-relaxed">
          {active.content}
        </MessageMarkdown>
      </div>
    </div>
  )
}
