import Link from "next/link"
import { Badge } from "@nessalabs/ui"
import { serverClient } from "@/lib/ledger"
import { formatMeasurement } from "@/lib/experiment-chart.mjs"
export const dynamic = "force-dynamic"
export default async function ExperimentsPage() {
  const goals = await serverClient().listGoals()
  return <div className="mx-auto flex max-w-5xl flex-col gap-6"><header className="space-y-2"><h1 className="text-2xl font-semibold tracking-tight">Experiments</h1><p className="max-w-2xl text-sm text-muted-foreground">Follow goals that agents improve through repeated attempts. Each goal sits alongside the task’s existing plan, reviews, and verification.</p></header>
    {!goals.length ? <div className="rounded-xl border border-dashed border-border p-8"><h2 className="text-sm font-medium">No iterative goals yet</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">Ask an agent to optimize a metric or improve something through experiments. The agent can attach a goal to an existing task; ordinary tasks continue as usual.</p></div> : <div className="grid gap-4">{goals.map(p => <Link key={p.goal.id} href={`/experiments/${p.goal.id}`} className="rounded-xl border border-border p-5 no-underline transition-colors hover:bg-muted/30"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">{p.goal.title}</h2><Badge variant="outline">{p.status === "active" ? "In progress" : p.status === "concluded" ? "Concluded" : "Budget reached"}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{p.goal.objective}</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span>{p.experiments.length} experiments</span><span>{p.goal.metric ? `Best observed: ${formatMeasurement(p.bestObserved?.value)} ${p.goal.metric.unit}` : "Qualitative improvement"}</span><span>{p.goal.workstreamId} · {p.goal.id}</span></div></Link>)}</div>}
  </div>
}
