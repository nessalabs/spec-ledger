"use client"

import * as React from "react"
import {
  AppShell,
  AppShellBody,
  AppShellMain,
  AppShellPaneDragHandle,
  AppShellWorkspace,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PopoverSurface,
  createAppShellLayout,
  useAppShell,
  PaneSplitDirection,
  type PaneNode,
} from "@nessa-ui/react"
import type { Claim, CodebaseGraph } from "@nessa/spec-ledger-client"
import { X } from "lucide-react"
import { StaticMermaid } from "@/components/static-mermaid"

type LayerViolation = {
  from: string
  to: string
  fromLayer: string
  toLayer: string
}

type Policy = { layers: string[]; allow: Record<string, string[]> } | null

export function GraphWorkspace({
  graph,
  claims,
  violations,
  policy,
}: {
  graph: CodebaseGraph
  claims: Claim[]
  violations: LayerViolation[]
  policy: Policy
}) {
  const claimById = React.useMemo(
    () => new Map(claims.map((c) => [c.id, c])),
    [claims],
  )

  return (
    <AppShell
      className="h-[calc(100svh-4.5rem)] min-h-[28rem] overflow-hidden rounded-xl border border-border"
      defaultLayout={createAppShellLayout({
        initialPaneId: "pane-graph",
        views: ["graph"],
        openDocks: [],
      })}
    >
      <AppShellBody>
        <AppShellMain>
          <AppShellWorkspace
            renderPane={(pane) => (
              <GraphPane
                pane={pane}
                graph={graph}
                claimById={claimById}
                violations={violations}
                policy={policy}
              />
            )}
          />
        </AppShellMain>
      </AppShellBody>
    </AppShell>
  )
}

function GraphPane({
  pane,
  graph,
  claimById,
  violations,
  policy,
}: {
  pane: PaneNode
  graph: CodebaseGraph
  claimById: Map<string, Claim>
  violations: LayerViolation[]
  policy: Policy
}) {
  const { splitPane, closePane } = useAppShell()
  const viewId = pane.activeViewId ?? pane.views[0] ?? "graph"

  const openClaim = React.useCallback(
    (claimId: string) => {
      const view = `claim:${claimId}`
      splitPane({
        paneId: pane.id,
        direction: PaneSplitDirection.Right,
        newPaneId: `pane-${claimId}-${Date.now()}`,
        views: [view],
        activeViewId: view,
      })
    },
    [pane.id, splitPane],
  )

  if (viewId.startsWith("claim:")) {
    const claimId = viewId.slice("claim:".length)
    const claim = claimById.get(claimId)
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
          <AppShellPaneDragHandle
            paneId={pane.id}
            className="px-1 text-xs text-muted-foreground"
          >
            {claimId}
          </AppShellPaneDragHandle>
          <button
            type="button"
            className="ms-auto inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close pane"
            onClick={() => closePane({ paneId: pane.id })}
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {claim ? (
            <ClaimDetail claim={claim} />
          ) : (
            <p className="text-sm text-muted-foreground">Unknown claim {claimId}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-3 text-xs text-muted-foreground">
        Structure
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <GraphMain
          graph={graph}
          claimById={claimById}
          violations={violations}
          policy={policy}
          onOpenClaim={openClaim}
        />
      </div>
    </div>
  )
}

function GraphMain({
  graph,
  claimById,
  violations,
  policy,
  onOpenClaim,
}: {
  graph: CodebaseGraph
  claimById: Map<string, Claim>
  violations: LayerViolation[]
  policy: Policy
  onOpenClaim: (id: string) => void
}) {
  const mermaid = toLayeredMermaid(graph)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Layer map</CardTitle>
          <CardDescription>
            rev {graph.system.revision} · {graph.nodes.length} nodes · {graph.edges.length}{" "}
            edges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StaticMermaid chart={mermaid} className="[&_svg]:max-w-full" />
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>
              Hover a claim id for its statement; click to open a split pane.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {graph.features.map((f) => (
              <div key={f.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{f.name}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {f.id}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{f.summary}</p>
                {f.claimIds?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {f.claimIds.map((id) => (
                      <ClaimChip
                        key={id}
                        claim={claimById.get(id)}
                        claimId={id}
                        onOpen={() => onOpenClaim(id)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Layer policy</CardTitle>
            <CardDescription>
              {violations.length
                ? `${violations.length} violation(s)`
                : "No violations"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs">
            {policy ? (
              Object.entries(policy.allow).map(([from, tos]) => (
                <div key={from}>
                  <span className="text-foreground">{from}</span>
                  <span className="text-muted-foreground"> → {tos.join(", ")}</span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No policy</p>
            )}
            {violations.map((v) => (
              <p key={`${v.from}-${v.to}`} className="text-destructive">
                {v.from} ({v.fromLayer}) → {v.to} ({v.toLayer})
              </p>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Nodes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {graph.nodes.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-mono text-xs">{n.id}</span>
                <Badge variant="outline">{n.layer}</Badge>
                <Badge variant="secondary">{n.kind}</Badge>
                {n.locator ? (
                  <span className="font-mono text-xs text-muted-foreground">{n.locator}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function ClaimChip({
  claimId,
  claim,
  onOpen,
}: {
  claimId: string
  claim?: Claim
  onOpen: () => void
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onOpen}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Badge variant="secondary" className="cursor-pointer font-mono hover:bg-accent">
          {claimId}
        </Badge>
      </button>
      <PopoverSurface
        className="pointer-events-none absolute start-0 top-full z-20 mt-2 hidden w-72 p-3 group-hover:block"
        elevation="xl"
      >
        <p className="font-mono text-[10px] text-muted-foreground">{claimId}</p>
        <p className="mt-1 text-xs leading-relaxed">
          {claim?.statement ?? "Claim not loaded in this ledger."}
        </p>
        {claim ? (
          <p className="mt-2 text-[10px] text-muted-foreground">
            {claim.kind}
            {claim.required ? " · required" : ""} · click to open pane
          </p>
        ) : null}
      </PopoverSurface>
    </span>
  )
}

function ClaimDetail({ claim }: { claim: Claim }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-lg font-semibold">{claim.id}</h2>
        <Badge variant="outline">{claim.kind}</Badge>
        {claim.required ? <Badge>required</Badge> : null}
      </div>
      <p className="text-sm leading-relaxed">{claim.statement}</p>
      {claim.links?.docs?.length ? (
        <p className="text-xs text-muted-foreground">docs: {claim.links.docs.join(", ")}</p>
      ) : null}
      {claim.area ? (
        <p className="font-mono text-xs text-muted-foreground">area: {claim.area}</p>
      ) : null}
    </div>
  )
}

/** Distinct prefixes so subgraph ids never collide with node ids (Mermaid parse fail). */
function toLayeredMermaid(graph: CodebaseGraph): string {
  const lines = ["flowchart TD"]
  for (const layer of graph.layers) {
    const nodes = graph.nodes.filter((n) => n.layer === layer.id)
    if (!nodes.length) continue
    const sg = `L_${safeId(layer.id)}`
    lines.push(`  subgraph ${sg}["${escapeLabel(layer.name)}"]`)
    for (const n of nodes) {
      const label = escapeLabel(n.name ?? n.id)
      lines.push(`    N_${safeId(n.id)}["${label}"]`)
    }
    lines.push("  end")
  }
  for (const e of graph.edges) {
    lines.push(
      `  N_${safeId(e.from)} -->|"${escapeLabel(e.kind)}"| N_${safeId(e.to)}`,
    )
  }
  return lines.join("\n")
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_")
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, "#quot;")
}
