import nextDynamic from "next/dynamic"
import { serverClient } from "@/lib/ledger"

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
  const [graph, violations, policy, claims] = await Promise.all([
    client.getGraph(),
    client.layerViolations(),
    client.getPolicy(),
    client.getClaims(),
  ])

  if (!graph) {
    return <p className="text-sm text-muted-foreground">No graph loaded.</p>
  }

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
