import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { loadLedger, sha256Stable } from "../fs/load.js"
import { checkSeal, computeSpecDigest, loadWorkstream, sealWorkstream, writeWorkstream } from "../workstream/load.js"
import { readSpecDocDigest } from "../workstream/doc-digest.js"
import { listAllReviews, unresolvedBlockingReviews } from "../reviews/load.js"
import { assertReviewLatticeCopy } from "../reviews/lattice-copy.js"
import type { Review, Workstream } from "../types.js"

export interface Authority {
  schemaVersion: 1
  id: string
  action: "grant" | "deny" | "revoke" | "restrict"
  mode?: "revision" | "request" | "standing"
  workstreamId?: string
  featureIds?: string[]
  excludeFeatureIds?: string[]
  revisionDigest?: string
  targetId?: string
  supersedes?: string[]
  source: { kind: "agent-reported"; reference: string }
  createdAt: string
}

export interface PermissionStatus {
  allowed: boolean
  mode?: Authority["mode"] | "legacy-seal"
  authorityId?: string
  revisionDigest: string
  reasons: string[]
  provenance: "agent-reported" | "legacy-unverified" | "none"
}

export function planRevision(root: string, ws: Workstream): string {
  return sha256Stable({specDigest:computeSpecDigest(ws),docDigest:ws.specPath ? readSpecDocDigest(root,ws)?.digest ?? "missing" : null})
}

export function listAuthorities(root: string): Authority[] {
  const dir = join(loadLedger(root).rootDir,"authority")
  return existsSync(dir) ? readdirSync(dir).filter(n=>n.endsWith(".json")).sort().map(n=>JSON.parse(readFileSync(join(dir,n),"utf8"))) : []
}

export function recordAuthority(root: string, input: Omit<Authority,"schemaVersion"|"createdAt"|"id"> & {id?:string}): Authority {
  if (!input.source?.reference?.trim() || input.source.kind !== "agent-reported") throw new Error("portable authority requires agent-reported source reference; no trusted host is connected")
  if (!["grant","deny","revoke","restrict"].includes(input.action)) throw new Error("invalid authority action")
  if (input.action === "grant" && !["revision","request","standing"].includes(input.mode ?? "")) throw new Error("grant mode required")
  if ((input.mode === "revision" || input.mode === "request" || input.action === "deny" || input.action === "restrict") && !input.workstreamId) throw new Error("request-specific authority requires a workstream")
  if (input.action === "grant" && !input.featureIds?.length) throw new Error("grant must state allowed feature IDs")
  const existing = listAuthorities(root)
  if (input.action === "revoke" && !existing.some(a=>a.id===input.targetId && a.action==="grant")) throw new Error("revoke requires an existing grant")
  if ((input.supersedes ?? []).some(id=>!existing.some(a=>a.id===id && a.workstreamId===input.workstreamId))) throw new Error("superseded authority must exist in the same workstream")
  if (input.workstreamId) {
    const ws=loadWorkstream(root,input.workstreamId)
    if ((input.mode === "revision" || input.action === "deny") && input.revisionDigest !== planRevision(root,ws)) throw new Error("approval or denial must name the current revision digest")
  }
  for (const ids of [input.featureIds,input.excludeFeatureIds,input.supersedes]) if (ids && (!Array.isArray(ids) || ids.some(id=>typeof id!=="string" || !id))) throw new Error("authority ID lists must contain nonempty strings")
  const id=input.id ?? `AUTH-${randomUUID()}`
  if (!/^AUTH-[a-zA-Z0-9_-]+$/.test(id)) throw new Error("invalid authority id")
  const record:Authority={...input,id,schemaVersion:1,createdAt:new Date().toISOString()}
  const dir=join(loadLedger(root).rootDir,"authority");mkdirSync(dir,{recursive:true})
  try { writeFileSync(join(dir,`${id}.json`),JSON.stringify(record,null,2)+"\n",{flag:"wx"}) }
  catch(error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    const prior=existing.find(a=>a.id===id)
    if (!prior || sha256Stable({...prior,createdAt:null})!==sha256Stable({...record,createdAt:null})) throw new Error("authority id already has different content")
    return prior
  }
  return record
}

export function permissionStatus(root: string, workstreamId: string): PermissionStatus {
  const ws=loadWorkstream(root,workstreamId)
  const revisionDigest=planRevision(root,ws)
  const result:PermissionStatus={allowed:false,revisionDigest,reasons:[],provenance:"none"}
  if (ws.status === "cancelled") return {...result,reasons:["Workstream is cancelled"]}
  const all=listAuthorities(root)
  const revoked=new Set(all.filter(a=>a.action==="revoke").map(a=>a.targetId))
  const superseded=new Set(all.flatMap(a=>a.supersedes ?? []))
  const relevant=all.filter(a=>!superseded.has(a.id) && (a.workstreamId===workstreamId || !a.workstreamId))
  const denied=relevant.filter(a=>a.action==="deny" && a.workstreamId===workstreamId)
  const restrictions=relevant.filter(a=>a.action==="restrict")
  if (restrictions.some(a=>ws.featureIds.some(f=>a.excludeFeatureIds?.includes(f) || (a.featureIds && !a.featureIds.includes(f))))) return {...result,reasons:["Request-specific restrictions exclude part of this plan"]}
  const scopedGrants=relevant.filter(a=>a.action==="grant" && a.workstreamId===workstreamId)
  // A specific request never silently falls back to broader standing permission.
  const grants=(scopedGrants.length ? scopedGrants : relevant.filter(a=>a.action==="grant" && a.mode==="standing")).filter(a=>!revoked.has(a.id))
  const grant=grants.find(a=>(a.mode!=="revision" || a.revisionDigest===revisionDigest) &&
    ws.featureIds.every(f=>a.featureIds?.includes(f) && !a.excludeFeatureIds?.includes(f)) &&
    denied.length === 0)
  if (grant) return {...result,allowed:true,mode:grant.mode,authorityId:grant.id,provenance:"agent-reported",reasons:["Explicit feature limits are satisfied; semantic scope still requires agent/reviewer judgment"]}
  if (all.some(a=>a.workstreamId===workstreamId) || ws.seal?.sealedBy.startsWith("agent:permission:")) return {...result,reasons:["No current applicable grant; approval, denial, revocation, or request limits prevent work"]}
  if (ws.seal && checkSeal(root,ws.id).ok) return {...result,allowed:true,mode:"legacy-seal",provenance:"legacy-unverified",reasons:["Existing seal retained for compatibility; signer identity is not authenticated"]}
  return {...result,reasons:["Approve this revision or supply an applicable delegation"]}
}

/** Called only by an explicit work transition. Reads never create a revision. */
export function prepareExecutablePlan(root: string, id: string): Workstream {
  const permission=permissionStatus(root,id)
  if (!permission.allowed) throw new Error(`work is not authorized (must be sealed or explicitly delegated): ${permission.reasons.join("; ")}`)
  let ws=loadWorkstream(root,id)
  if (ws.seal && checkSeal(root,ws.id).ok) return ws
  if (!ws.suggestedSlices?.length) throw new Error("shape at least one executable slice before work")
  if (ws.policy?.requireSpecBreak !== false) {
    const reviews=listAllReviews(root).filter(r=>r.workstreamId===id && r.target==="spec")
    const expected=(ws as Workstream & {specBreakReviewId?:string}).specBreakReviewId
    const approval=reviews.find(r=>r.id===expected && r.verdict==="approve" && r.revisionDigest===permission.revisionDigest)
    if (!approval || unresolvedBlockingReviews(reviews).length) throw new Error("a current spec review approval without unresolved blockers is required before work")
    assertReviewLatticeCopy(approval)
  }
  if (ws.status === "draft") { ws={...ws,status:"shaped"};writeWorkstream(root,ws) }
  return sealWorkstream(root,id,`agent:permission:${permission.authorityId}`)
}

/** Separate spec reviewer supplies judgment; the tool stamps the plan it actually reviewed. */
export function recordSpecReview(root:string,review:Review):Review {
  if (!review.workstreamId || review.turnId || review.target!=="spec" || !new RegExp(`^${review.workstreamId}/SR-[0-9]+$`).test(review.id)) throw new Error("spec review requires a workstream review ID")
  const ws=loadWorkstream(root,review.workstreamId)
  const stamped={...review,revisionDigest:planRevision(root,ws)}
  assertReviewLatticeCopy(stamped)
  const ledger=loadLedger(root)
  const dir=join(ledger.rootDir,ledger.config.reviewsDir ?? "reviews","workstreams",ws.id)
  mkdirSync(dir,{recursive:true})
  writeFileSync(join(dir,`${review.id.split("/").at(-1)}.json`),JSON.stringify(stamped,null,2)+"\n",{flag:"wx"})
  return stamped
}
