import { serverClient } from "@/lib/ledger"
import { WorkstreamsList } from "@/components/workstreams-list"
import { fixupLink, specListPage, specListProgress, specView, specViewCounts, workstreamFixups } from "@/lib/workstream-list"

export const dynamic = "force-dynamic"

export default async function WorkstreamsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const client = serverClient()
  const [query, workstreams, turns] = await Promise.all([searchParams, client.listWorkstreams(), client.getTurns()])
  const view = specView(query.view)
  const selection = specListPage(workstreams, turns, view, query.page)
  const rows = await Promise.all(selection.workstreams.map(async workstream => {
    const projection = workstream.status === "cancelled" ? null : await client.getSession(workstream.id).catch(() => null)
    const latest = workstreamFixups(turns, workstream.id)[0]
    return { workstream, progress: specListProgress(workstream.id, projection), latestFixup: latest ? fixupLink(latest) : null }
  }))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Specs</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Read a spec, follow its changes, and inspect the evidence behind it.
        </p>
      </header>

      <WorkstreamsList rows={rows} view={view} counts={specViewCounts(workstreams)} page={selection.page} pages={selection.pages} observedAt={new Date().toISOString()} />
    </div>
  )
}
