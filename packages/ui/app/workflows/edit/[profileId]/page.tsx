import { WorkflowBuilder } from '@/components/workflow-builder'
export default async function EditWorkflowPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params
  return <WorkflowBuilder profileId={profileId} />
}
