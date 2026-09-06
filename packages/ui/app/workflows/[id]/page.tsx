import Link from "next/link"
import { notFound } from "next/navigation"
import { serverClient } from "@/lib/ledger"
import { LiveWorkflow } from "@/components/live-workflow"

export const dynamic = "force-dynamic"

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const projection = await serverClient().getSession(id)
  if (!projection.session) notFound()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <Link className="text-sm underline" href={`/workstreams/${id}`}>
          Back to {projection.session.title}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">How your agent works</h1>
        <p className="text-sm text-muted-foreground">
          The steps and skills this spec follows, and how far they have got.
        </p>
      </header>
      <LiveWorkflow initial={projection} workstreamId={id} />
    </div>
  )
}
