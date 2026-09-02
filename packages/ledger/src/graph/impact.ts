import type { CodebaseGraph } from "../types.js"

export function blastRadius(
  graph: CodebaseGraph,
  nodeId: string,
): { direct: string[]; transitive: string[] } {
  const reverse = new Map<string, string[]>()
  for (const e of graph.edges) {
    const list = reverse.get(e.to) ?? []
    list.push(e.from)
    reverse.set(e.to, list)
  }

  const direct = [...new Set(reverse.get(nodeId) ?? [])].sort()
  const seen = new Set<string>([nodeId])
  const queue = [...direct]
  const transitive: string[] = []

  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    transitive.push(id)
    for (const dep of reverse.get(id) ?? []) {
      if (!seen.has(dep)) queue.push(dep)
    }
  }

  return { direct, transitive: transitive.sort() }
}

export function layerViolations(
  graph: CodebaseGraph,
  allow: Record<string, string[]>,
): Array<{ from: string; to: string; fromLayer: string; toLayer: string }> {
  const layerOf = new Map(graph.nodes.map((n) => [n.id, n.layer]))
  const out: Array<{ from: string; to: string; fromLayer: string; toLayer: string }> = []
  for (const e of graph.edges) {
    if (e.kind !== "depends_on" && e.kind !== "calls" && e.kind !== "implements") continue
    const fromLayer = layerOf.get(e.from)
    const toLayer = layerOf.get(e.to)
    if (!fromLayer || !toLayer) continue
    const ok = (allow[fromLayer] ?? []).includes(toLayer)
    if (!ok) out.push({ from: e.from, to: e.to, fromLayer, toLayer })
  }
  return out
}
