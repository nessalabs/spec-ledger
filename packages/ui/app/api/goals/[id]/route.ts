import { serverClient } from "@/lib/ledger"
export const dynamic = "force-dynamic"
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try { return Response.json({ projection: await serverClient().getGoal(id), capturedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } }) }
  catch { return Response.json({ error: "Goal is unavailable" }, { status: 404, headers: { "Cache-Control": "no-store" } }) }
}
