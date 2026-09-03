import { notFound } from "next/navigation"
import { liveReport, serverClient } from "@/lib/ledger"
import { readCommit } from "@/lib/git"
import { readRepoMarkdown, readRepoText } from "@/lib/spec-md"
import { TurnDetail, type RelatedDoc } from "@/components/turn-detail"
import { TurnDocSplit } from "@/components/turn-doc-split"

export const dynamic = "force-dynamic"

const STANDING_DOCS: Omit<RelatedDoc, "content">[] = [
  { path: "DESIGN.md", label: "Design invariants" },
  { path: "docs/architecture/work-model.md", label: "Work model" },
  { path: "docs/architecture/episodes.md", label: "Episodes" },
]

export default async function TurnPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = serverClient()
  let episode
  try {
    episode = await client.getTurnEpisode(id)
  } catch {
    notFound()
  }
  const turn = episode.turn
  const [report, claims, graph] = await Promise.all([
    liveReport(),
    client.getClaims(),
    client.getGraph(),
  ])

  let workstream = null
  if (turn.intent.workstreamId) {
    try {
      workstream = await client.getWorkstream(turn.intent.workstreamId)
    } catch {
      workstream = null
    }
  }

  const specPath =
    workstream && "specPath" in workstream
      ? (workstream as { specPath?: string }).specPath
      : undefined
  const planMarkdown = readRepoMarkdown(specPath)

  const commit = readCommit(turn.facts?.commit ?? null)

  const docPaths = new Map<string, RelatedDoc>()
  for (const d of STANDING_DOCS) docPaths.set(d.path, d)
  if (specPath) {
    docPaths.set(specPath, {
      path: specPath,
      label: workstream?.title ?? "Workstream pitch",
    })
  }
  const claimIds = new Set([
    ...(turn.facts?.touchedClaimIds ?? []),
    ...(turn.intent.claimedClaimIds ?? []),
  ])
  for (const c of claims) {
    if (!claimIds.has(c.id)) continue
    for (const path of c.links?.docs ?? []) {
      if (!docPaths.has(path)) {
        docPaths.set(path, { path, label: `${c.id} · ${path.split("/").pop()}` })
      }
    }
  }

  const relatedDocs = [...docPaths.values()].map((d) => ({
    ...d,
    content: readRepoText(d.path),
  }))

  const featureMeta = (graph?.features ?? []).map((f) => ({
    id: f.id,
    name: f.name,
  }))

  return (
    <TurnDocSplit docs={relatedDocs}>
      <TurnDetail
        turn={turn}
        report={report}
        episode={episode}
        workstream={workstream}
        commit={commit}
        relatedDocs={relatedDocs}
        planMarkdown={planMarkdown}
        planPath={specPath}
        featureMeta={featureMeta}
      />
    </TurnDocSplit>
  )
}
