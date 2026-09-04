import nextDynamic from "next/dynamic"
import { serverClient } from "@/lib/ledger"
import { graphDisplayIssue } from "@nessalabs/spec-ledger-client"

const GraphWorkspace = nextDynamic(
  () =>
    import("@/components/graph-workspace").then((m) => m.GraphWorkspace),
  {
    loading: () => (
      <div className="flex h-[28rem] items-center justify-center rounded-xl border border-border text-sm text-muted-foreground">
        Loading graph…
      </div>
    ),
  },
)

export const dynamic = "force-dynamic"

export default async function GraphPage() {
  const client = serverClient()
  const graph = await client.getGraph()
  const issue = graphDisplayIssue(graph)
  if (issue || !graph) {
    return <section className="space-y-2 rounded-xl border border-border p-5"><h1 className="text-xl font-semibold">Graph unavailable</h1><p role="status" className="text-sm text-muted-foreground">{issue}</p><p className="text-sm text-muted-foreground">Check the graph record in this checkout. No architecture result is inferred from incomplete data.</p></section>
  }
  const [violations, policy, claims] = await Promise.all([
    client.layerViolations(),
    client.getPolicy(),
    client.getClaims(),
  ])

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
      <header className="flex shrink-0 flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Graph
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Structure</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Features, packages, and edges from{" "}
          <code className="text-foreground">.spec-ledger/graph/</code>. Hover claim
          ids for statements; click to open a split pane.
        </p>
      </header>

      <GraphWorkspace
        graph={graph}
        claims={claims}
        violations={violations}
        policy={policy}
      />
    </div>
  )
}
