import { serverClient } from "@/lib/ledger"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("workstream") ?? undefined
  try {
    const result = await serverClient().getSession(id)
    return Response.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return Response.json({ error: "Session could not be observed. Check the local ledger and connection." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
