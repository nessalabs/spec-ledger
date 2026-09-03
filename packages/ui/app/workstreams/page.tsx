import Link from "next/link"
import { serverClient } from "@/lib/ledger"

export const dynamic = "force-dynamic"

export default async function WorkstreamsPage() {
  const client = serverClient()
  const workstreams = await client.listWorkstreams()
  const ordered = [...workstreams].sort((a, b) => b.id.localeCompare(a.id))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Workstreams
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Workstreams</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Open a workstream, then follow what shipped under it.
        </p>
      </header>

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workstreams yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {ordered.map((w) => (
            <li key={w.id}>
              <Link
                href={`/workstreams/${w.id}`}
                className="grid gap-0.5 px-3 py-2.5 no-underline transition-colors hover:bg-muted/40 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-3"
              >
                <span className="font-mono text-xs font-semibold text-foreground">
                  {w.id}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-1 text-sm font-medium text-foreground">
                    {w.title}
                  </span>
                  <span className="mt-0.5 line-clamp-1 block text-[11px] text-muted-foreground">
                    {w.problem}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] capitalize text-muted-foreground">
                  {w.status}
                  {w.seal ? ` · rev ${w.seal.revision}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
