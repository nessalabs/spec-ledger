import { randomBytes } from "node:crypto"
import { sha256Stable } from "../fs/load.js"
import { loadWorkstream } from "../workstream/load.js"
import { listAuthorities, permissionStatus, planRevision, recordAuthority } from "./authority.js"

export function authorityStateDigest(root: string): string {
  return sha256Stable(listAuthorities(root))
}

/** Narrow local browser adapter. The projection server remains GET-only. */
export function createLocalApprovalBridge(root: string) {
  const token = randomBytes(32).toString("hex")
  const json = (status: number, data: unknown) => Response.json(data, { status, headers: {
    "cache-control": "no-store", "x-content-type-options": "nosniff",
  } })
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const host = request.headers.get("host") ?? url.host
    let hostUrl: URL
    try { hostUrl = new URL(`http://${host}`) } catch { return json(403, { error: "Local host required" }) }
    // Next may normalize request.url to localhost while retaining the browser Host.
    const loopback = ["localhost", "127.0.0.1", "[::1]"]
    if (!loopback.includes(hostUrl.hostname) || !loopback.includes(url.hostname) ||
        hostUrl.host !== host || hostUrl.port !== url.port) {
      return json(403, { error: "Local host required" })
    }
    const origin = request.headers.get("origin")
    if (origin && origin !== `${url.protocol}//${hostUrl.host}`) return json(403, { error: "Same-origin browser action required" })
    if (request.headers.get("sec-fetch-site") === "cross-site") return json(403, { error: "Same-origin browser action required" })
    if (request.method === "GET") return json(200, { token })
    if (request.method !== "POST") return json(405, { error: "Unsupported approval method" })
    if (!origin || request.headers.get("x-spec-ledger-token") !== token ||
        request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return json(403, { error: "Same-origin approval token required" })
    }
    const reader = request.body?.getReader()
    if (!reader) return json(400, { error: "Approval request required" })
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 4096) { await reader.cancel(); return json(413, { error: "Approval request too large" }) }
      chunks.push(value)
    }
    let input: Record<string, unknown>
    try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { return json(400, { error: "Invalid approval JSON" }) }
    if (!input || Array.isArray(input) || typeof input !== "object" ||
        Object.keys(input).some(key => !["action", "workstreamId", "revisionDigest", "authorityDigest", "requestId"].includes(key)) ||
        !["approve", "deny"].includes(input.action as string) ||
        typeof input.workstreamId !== "string" || !/^W-\d{3,}$/.test(input.workstreamId) ||
        typeof input.revisionDigest !== "string" || !/^[a-f0-9]{64}$/.test(input.revisionDigest) ||
        typeof input.authorityDigest !== "string" || !/^[a-f0-9]{64}$/.test(input.authorityDigest) ||
        typeof input.requestId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId)) {
      return json(400, { error: "Only a revision-bound approve or deny action is accepted" })
    }
    try {
      const ws = loadWorkstream(root, input.workstreamId)
      if (ws.status === "done" || ws.status === "cancelled") return json(409, { error: "This workstream is no longer awaiting a decision" })
      if (planRevision(root, ws) !== input.revisionDigest) return json(409, { error: "The spec changed. Review the current revision before deciding." })
      const id = `AUTH-UI-${input.requestId}`
      const existing = listAuthorities(root)
      const prior = existing.find(a => a.id === id)
      if (prior) {
        if (prior.workstreamId !== ws.id || prior.revisionDigest !== input.revisionDigest || prior.action !== (input.action === "approve" ? "grant" : "deny")) return json(409, { error: "Request ID already used for another decision" })
        return json(200, { saved: true, permission: permissionStatus(root, ws.id) })
      }
      if (authorityStateDigest(root) !== input.authorityDigest) return json(409, { error: "Permission changed. Review the current state before deciding." })
      const current = permissionStatus(root, ws.id)
      recordAuthority(root, {
        id, action: input.action === "approve" ? "grant" : "deny", mode: "revision",
        workstreamId: ws.id, featureIds: ws.featureIds, revisionDigest: input.revisionDigest,
        ...(input.action === "approve" ? { supersedes: existing.filter(a => a.workstreamId === ws.id && a.action === "deny").map(a => a.id) } : current.authorityId ? { targetId: current.authorityId } : {}),
        source: { kind: "agent-reported", reference: "local-ui:explicit-browser-action; local identity is not authenticated" },
      })
      return json(200, { saved: true, permission: permissionStatus(root, ws.id) })
    } catch (error) { return json(409, { error: error instanceof Error ? error.message : "Approval could not be saved" }) }
  }
}
