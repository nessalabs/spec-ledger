import { LiveSession } from "@/components/live-session"
import { serverClient } from "@/lib/ledger"

export const dynamic = "force-dynamic"

export default async function OverviewPage() {
  const initial = await serverClient().getSession()
  return <div className="mx-auto max-w-5xl"><LiveSession initial={initial} /></div>
}
