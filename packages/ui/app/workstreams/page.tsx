import { serverClient } from "@/lib/ledger"
import { WorkstreamsList } from "@/components/workstreams-list"

export const dynamic = "force-dynamic"

export default async function WorkstreamsPage() {
  const client = serverClient()
  const workstreams = await client.listWorkstreams()

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Specs
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Specs</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Read a spec, follow its changes, and inspect the evidence behind it.
        </p>
      </header>

      <WorkstreamsList workstreams={workstreams} />
    </div>
  )
}
