import Link from "next/link"
import { serverClient } from "@/lib/ledger"
export const dynamic = "force-dynamic"
export default async function WorkflowsPage() {
  const workstreams = await serverClient().listWorkstreams()
  return <div className="mx-auto max-w-5xl space-y-6"><header><h1 className="text-2xl font-semibold">Workflows</h1><p className="mt-2 text-muted-foreground">Choose a feature to view or change its workflow.</p></header><ul className="divide-y divide-border rounded-xl border border-border">{[...workstreams].reverse().map(workstream => <li key={workstream.id}><Link className="block p-4 hover:bg-muted" href={`/workflows/${workstream.id}`}>{workstream.title}<span className="ml-3 text-sm text-muted-foreground">{workstream.id}</span></Link></li>)}</ul></div>
}
