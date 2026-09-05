import { LiveSession } from "@/components/live-session"
import { serverClient } from "@/lib/ledger"

export const dynamic = "force-dynamic"

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ workstream?: string }> }) {
  const { workstream } = await searchParams
  const initial = await serverClient().getSession(workstream)
  return <div className="mx-auto max-w-5xl"><LiveSession initial={initial} /></div>
}
