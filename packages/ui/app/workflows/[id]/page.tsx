import Link from "next/link"
import { notFound } from "next/navigation"
import { serverClient } from "@/lib/ledger"
import { LiveWorkflow } from "@/components/live-workflow"
export const dynamic = "force-dynamic"
export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const projection = await serverClient().getSession(id)
  if (!projection.session) notFound()
  return <div className="mx-auto max-w-5xl space-y-6"><header className="space-y-3"><Link className="text-sm underline" href="/workflows">All workflows</Link><h1 className="text-2xl font-semibold">How your agent works</h1><p>{projection.session.title}</p><Link className="inline-block text-sm underline" href={`/workstreams/${id}#evidence`}>Back to spec and evidence</Link></header><LiveWorkflow initial={projection} workstreamId={id} /></div>
}
