import { notFound } from "next/navigation"
import { serverClient } from "@/lib/ledger"
import { TurnDetail } from "@/components/turn-detail"

export const dynamic = "force-dynamic"

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
  const report = await client.verify()
  return (
    <div className="mx-auto max-w-5xl">
      <TurnDetail turn={episode.turn} report={report} episode={episode} />
    </div>
  )
}
