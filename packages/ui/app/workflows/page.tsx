import { WorkflowLibrary } from '@/components/workflow-library'
import { serverClient } from '@/lib/ledger'
export const dynamic = 'force-dynamic'
export default async function WorkflowsPage() {
  const projection = await serverClient().getSession()
  return <div className="mx-auto max-w-5xl space-y-6"><header className="space-y-2"><h1 className="text-2xl font-semibold tracking-tight">Workflows</h1><p className="max-w-2xl text-sm text-muted-foreground">Define a way of working once, then choose it by name on any spec. Changing a saved workflow leaves earlier selections untouched.</p></header><WorkflowLibrary specs={projection.choices} /></div>
}
