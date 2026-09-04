import type { Turn } from "@nessalabs/spec-ledger-client"

type TurnFileChange = NonNullable<Turn["facts"]>["files"][number]

/** Prefer product paths; ledger JSON is bookkeeping noise for most readers. */
export function splitTurnFiles(files: TurnFileChange[]) {
  const product: TurnFileChange[] = []
  const ledger: TurnFileChange[] = []
  for (const f of files) {
    if (f.path.startsWith(".spec-ledger/")) ledger.push(f)
    else product.push(f)
  }
  return { product, ledger }
}

export function fileKindLabel(kind: TurnFileChange["kind"]): string {
  switch (kind) {
    case "added":
      return "+"
    case "deleted":
      return "−"
    case "renamed":
      return "→"
    default:
      return "~"
  }
}

export function shortPath(path: string): string {
  const parts = path.split("/")
  if (parts.length <= 3) return path
  if (parts[0] === "packages" && parts.length >= 3) {
    return `${parts[0]}/${parts[1]}/…/${parts[parts.length - 1]}`
  }
  return `…/${parts.slice(-2).join("/")}`
}

export type FileArea = {
  area: string
  files: TurnFileChange[]
  additions: number
  deletions: number
}

/** Group product files by package / top folder for a quick architecture scan. */
export function groupFilesByArea(files: TurnFileChange[]): FileArea[] {
  const map = new Map<string, TurnFileChange[]>()
  for (const f of files) {
    const area = areaForPath(f.path)
    const list = map.get(area) ?? []
    list.push(f)
    map.set(area, list)
  }
  return [...map.entries()]
    .map(([area, list]) => ({
      area,
      files: list.slice().sort((a, b) => a.path.localeCompare(b.path)),
      additions: list.reduce((n, f) => n + (f.additions ?? 0), 0),
      deletions: list.reduce((n, f) => n + (f.deletions ?? 0), 0),
    }))
    .sort((a, b) => b.files.length - a.files.length || a.area.localeCompare(b.area))
}

function areaForPath(path: string): string {
  const parts = path.split("/")
  if (parts[0] === "packages" && parts[1]) return `packages/${parts[1]}`
  if (parts[0] === "schemas") return "schemas"
  if (parts[0] === "docs") return "docs"
  if (parts[0] === ".github") return ".github"
  if (parts[0] === "skills") return "skills"
  return parts[0] || path
}

export function turnImpactSummary(turn: Turn) {
  const files = turn.facts?.files ?? []
  const { product, ledger } = splitTurnFiles(files)
  const areas = groupFilesByArea(product)
  const additions = product.reduce((n, f) => n + (f.additions ?? 0), 0)
  const deletions = product.reduce((n, f) => n + (f.deletions ?? 0), 0)
  const added = product.filter((f) => f.kind === "added").length
  const modified = product.filter((f) => f.kind === "modified").length
  const deleted = product.filter((f) => f.kind === "deleted").length
  return {
    product,
    ledger,
    areas,
    additions,
    deletions,
    added,
    modified,
    deleted,
    features: turn.facts?.touchedFeatureIds ?? turn.intent.featureIds ?? [],
    nodes: turn.facts?.touchedNodeIds ?? [],
    claims: turn.facts?.touchedClaimIds ?? [],
    blastDirect: turn.facts?.blastRadius.direct ?? [],
    blastTransitive: turn.facts?.blastRadius.transitive ?? [],
    previewPaths: product.slice(0, 6),
  }
}

export function formatWhen(iso: string | undefined | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function humanStatus(status: Turn["status"]): string {
  if (status === "open") return "In progress"
  if (status === "abandoned") return "Abandoned"
  return "Shipped"
}
