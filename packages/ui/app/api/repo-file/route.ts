import { NextResponse } from "next/server"
import { readRepoText } from "@/lib/spec-md"

export const dynamic = "force-dynamic"

/** GET /api/repo-file?path=docs/... — repo-relative text for the doc reader. */
export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path")
  if (!path) {
    return NextResponse.json({ error: "path required" }, { status: 400 })
  }
  const text = readRepoText(path)
  if (text === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  return new NextResponse(text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}
