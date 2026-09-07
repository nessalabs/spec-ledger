import { serverClient } from "@/lib/ledger"
import { specListProgress } from "@/lib/workstream-list"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const workstreamId = new URL(request.url).searchParams.get("workstream")
  const headers = { "Cache-Control": "no-store" }
  if (!workstreamId) return Response.json({ error: "Choose a spec." }, { status: 400, headers })
  try {
    const projection = await serverClient().getSession(workstreamId)
    return Response.json({ workstreamId, progress: specListProgress(workstreamId, projection) }, { headers })
  } catch {
    return Response.json({ error: "Progress could not be observed." }, { status: 503, headers })
  }
}
