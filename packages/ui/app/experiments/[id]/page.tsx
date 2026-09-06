import { notFound } from "next/navigation"
import { serverClient } from "@/lib/ledger"
import { ExperimentInspect } from "@/components/experiment-inspect"
export const dynamic = "force-dynamic"
export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let projection
  try { projection = await serverClient().getGoal(id) } catch { notFound() }
  return <ExperimentInspect key={id} initial={projection} capturedAt={new Date().toISOString()} />
}
