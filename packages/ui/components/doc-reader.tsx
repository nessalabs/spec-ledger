"use client"

import * as React from "react"
import nextDynamic from "next/dynamic"

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

function missingDocMarkdown(path: string): string {
  return [
    `# Could not open`,
    "",
    `\`${path}\` was not found in this checkout (or is outside the repo).`,
    "",
    "Use **Read** on a related doc, or fix the link target.",
    "",
  ].join("\n")
}

/** Heavy markdown + SplitView — only load when a reader tab is open. */
const DocReaderLayout = nextDynamic(
  () => import("./doc-reader-layout").then((m) => m.DocReaderLayout),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
        Opening reader…
      </div>
    ),
  },
)

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
      const label =
        doc.label ?? cached?.label ?? doc.path.split("/").pop() ?? doc.path
      const known = doc.content ?? cached?.content

      const focusOrAdd = (content: string) => {
        cacheRef.current.set(doc.path, { label, content })
        setTabs((prev) => {
          const i = prev.findIndex((t) => t.path === doc.path)
          if (i === -1) return [...prev, { path: doc.path, label, content }]
          const next = [...prev]
          next[i] = { path: doc.path, label, content }
          return next
        })
        setActivePath(doc.path)
      }

      if (known) {
        focusOrAdd(known)
        return
      }

      focusOrAdd(`_Loading \`${doc.path}\`…_`)
      void fetchRepoText(doc.path).then((text) => {
        focusOrAdd(text ?? missingDocMarkdown(doc.path))
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
        <DocReaderLayout
          tabs={tabs}
          activePath={active.path}
          onSelect={setActivePath}
          onCloseTab={closeTab}
          onCloseAll={closeReader}
          onOpenDoc={openDoc}
        >
          {children}
        </DocReaderLayout>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-pt-28 p-6">
          {children}
        </div>
      )}
    </DocReaderContext.Provider>
  )
}
