import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { loadLedger, sha256Stable } from "../fs/load.js"
import { permissionStatus } from "../permission/authority.js"
import { listWorkstreams, loadWorkstream, checkSeal } from "../workstream/load.js"
import { verifyLedger } from "../verify/verify.js"
import type { EpisodeDecision } from "../types.js"

export interface DeferredCommitment {
  deferred: string
  originSpecRef: string
  when: { kind: "feature-planned"; featureId: string }
  response: "revisit" | "implement"
  gate: "before-feature-complete"
  requirementRef?: string
}
export interface DeferralResolution {
  decisionRef: string
  action: "revisited" | "dismissed" | "cancelled" | "re-deferred"
  authorityRef: string
  workstreamId: string
  revisionDigest: string
}
export type DeferredDecision = EpisodeDecision & { deferral?: DeferredCommitment; deferralResolution?: DeferralResolution }
interface Activation {
  schemaVersion: 1
  decision: DeferredDecision
  workstreamId: string
  activatedAt: string
}
export interface DeferralEvaluation {
  decisionRef: string
  decision: DeferredDecision
  state: "not-due" | "due" | "unknown" | "resolved"
  affected: boolean
  activated: boolean
  reasons: string[]
  resolutionRef?: string
}

function nonempty(value:unknown):value is string { return typeof value==="string" && value.trim().length>0 }
function object(value:unknown):value is Record<string,unknown> { return value!==null && typeof value==="object" && !Array.isArray(value) }
function validDecision(d:DeferredDecision):boolean {
  return object(d) && d.schemaVersion===1 && nonempty(d.turnId) && /^T-[0-9]{3,}$/.test(d.turnId) &&
    nonempty(d.id) && new RegExp(`^${d.turnId}/D-[0-9]+$`).test(d.id) && nonempty(d.decision) && nonempty(d.rationale)
}
function validResolution(r:unknown):r is DeferralResolution {
  return object(r) && nonempty(r.decisionRef) && /^T-[0-9]{3,}\/D-[0-9]+$/.test(r.decisionRef) &&
    nonempty(r.workstreamId) && /^W-[0-9]{3,}$/.test(r.workstreamId) && nonempty(r.authorityRef) &&
    nonempty(r.revisionDigest) && typeof r.action==="string" && ["revisited","dismissed","cancelled","re-deferred"].includes(r.action)
}
function read<T>(path: string): T { return JSON.parse(readFileSync(path,"utf8")) as T }
function allJson<T>(dir: string): T[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>
    entry.isDirectory() ? allJson<T>(join(dir,entry.name)) : entry.isFile() && entry.name.endsWith(".json") ? [read<T>(join(dir,entry.name))] : [])
}
/** Reads the entire collection, including orphaned/old turn decisions; no recent-turn cap. */
export function listDeferredDecisions(root: string): DeferredDecision[] {
  const ledger=loadLedger(root)
  return allJson<DeferredDecision>(join(ledger.rootDir,ledger.config.decisionsDir ?? "decisions"))
    .filter(d=>object(d) && ("deferral" in d || "deferralResolution" in d))
}
function activations(root: string): Activation[] {
  return allJson<Activation>(join(loadLedger(root).rootDir,"deferral-activations")).map((a,index)=> {
    if (object(a) && object(a.decision)) return a
    // A damaged receipt cannot silently erase the commitment it was preserving.
    return {...(object(a) ? a : {}),decision:{id:`invalid-activation-${index}`,deferral:{}}} as Activation
  })
}
function immutable(path:string, value:unknown):void {
  mkdirSync(dirname(path),{recursive:true})
  try { writeFileSync(path,JSON.stringify(value,null,2)+"\n",{flag:"wx"}) }
  catch(error) {
    if ((error as NodeJS.ErrnoException).code!=="EEXIST") throw error
    if (sha256Stable(read(path))!==sha256Stable(value)) throw new Error("record ID already contains different content")
  }
}
function validateDecision(d:DeferredDecision):void {
  if (!validDecision(d)) throw new Error("valid schema, decision ID, decision, and rationale are required")
}
function validDeferral(d:DeferredDecision):boolean {
  const v=d?.deferral
  return validDecision(d) && object(v) && nonempty(v.deferred) && nonempty(v.originSpecRef) && object(v.when) && v.when.kind==="feature-planned" &&
    nonempty(v.when.featureId) && ["revisit","implement"].includes(v.response) &&
    v.gate==="before-feature-complete" && (v.requirementRef===undefined || nonempty(v.requirementRef)) && (v.response!=="implement" || nonempty(v.requirementRef))
}
function persistDecision(root:string,d:DeferredDecision):DeferredDecision {
  validateDecision(d)
  const ledger=loadLedger(root)
  if (!ledger.turns.some(t=>t.id===d.turnId && t.status==="open")) throw new Error("record decisions on an open turn")
  immutable(join(ledger.rootDir,ledger.config.decisionsDir ?? "decisions",d.turnId,`${d.id.split("/")[1]}.json`),d)
  return d
}
export function recordDeferredDecision(root:string,d:DeferredDecision):DeferredDecision {
  if (!validDeferral(d) || d.deferralResolution) throw new Error("a deferral needs an origin, observable feature trigger, response, and completion gate")
  return persistDecision(root,d)
}

/** Pure projection: missing references are unknown, and persisted activation survives feature edits. */
export function evaluateDeferrals(root:string,workstreamId:string):DeferralEvaluation[] {
  const ledger=loadLedger(root), ws=loadWorkstream(root,workstreamId)
  const decisions=listDeferredDecisions(root), active=activations(root)
  const originals=new Map(decisions.filter(d=>"deferral" in d).map(d=>[d.id,d]))
  // The activated snapshot remains authoritative if someone deletes/rewrites its source decision.
  for (const a of active) if (!originals.has(a.decision.id)) originals.set(a.decision.id,a.decision)
  const report=verifyLedger(ledger)
  return [...originals.values()].sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(decision=> {
    const records=active.filter(a=>a.decision.id===decision.id)
    const snapshot=records[0]?.decision ?? decision
    const rawFeature=snapshot.deferral?.when?.featureId
    const feature=nonempty(rawFeature) ? rawFeature : undefined
    const affected=ws.featureIds.includes(feature ?? "") || records.some(a=>a.workstreamId===workstreamId) || !feature
    const triggered=records.length>0 || (affected && ["sealed","active","done"].includes(ws.status))
    const base:DeferralEvaluation={decisionRef:nonempty(decision.id) ? decision.id : "invalid-decision",decision:snapshot,state:"not-due",affected,activated:records.length>0,reasons:[]}
    if (!validDeferral(snapshot) || records.some(a=>a.schemaVersion!==1 || !nonempty(a.workstreamId) || !/^W-[0-9]{3,}$/.test(a.workstreamId) || !nonempty(a.activatedAt))) return {...base,state:"unknown",reasons:["Deferral trigger, response, or requirement reference is incomplete"]}
    if (records.some(a=>sha256Stable(a.decision)!==sha256Stable(snapshot)) || (records.length && !decisions.some(d=>d.id===decision.id && sha256Stable(d)===sha256Stable(snapshot))))
      return {...base,state:"unknown",reasons:["An activated decision was changed or removed; preserve its original commitment"]}
    if (!ledger.graph?.features?.some(f=>f.id===feature)) return {...base,state:"unknown",reasons:["Referenced feature is missing"]}
    const deferral=snapshot.deferral!
    const originId=deferral.originSpecRef.split("/")[0]
    if (!listWorkstreams(root).some(w=>w.id===originId)) return {...base,state:"unknown",reasons:["Origin spec workstream is missing"]}
    if (deferral.response==="implement" && !ledger.claims.some(c=>c.id===deferral.requirementRef && !c.deprecated)) return {...base,state:"unknown",reasons:["Referenced requirement is missing or deprecated"]}
    if (!triggered) return base
    if (deferral.response==="implement") {
      const checks=ledger.bindings.filter(b=>b.claimId===deferral.requirementRef)
      const behavioral=checks.some(b=>b.locator.type==="command" || b.locator.type==="results-row")
      const passed=report.claims.find(c=>c.claimId===deferral.requirementRef)?.outcome==="pass"
      return {...base,state:behavioral && passed ? "resolved" : "due",reasons:behavioral && passed ? ["Required behavior has current passing evidence"] : ["Required behavior needs current passing evidence; paths and attestation are insufficient"]}
    }
    const resolution=decisions.find(d=> {
      const r=d.deferralResolution
      if (!validDecision(d) || !validResolution(r) || r.decisionRef!==decision.id) return false
      if (!records.some(a=>a.workstreamId===r.workstreamId) && r.workstreamId!==workstreamId) return false
      try {
        const permission=permissionStatus(root,r.workstreamId)
        return permission.allowed && permission.authorityId===r.authorityRef && permission.revisionDigest===r.revisionDigest &&
          (r.action!=="re-deferred" || (!!d.deferral && validDeferral(d) && d.id!==decision.id))
      } catch { return false }
    })
    return {...base,state:resolution ? "resolved" : "due",resolutionRef:resolution?.id,reasons:resolution ? ["An authorized decision records the required revisit"] : ["An authorized recorded revisit is required"]}
  })
}

/** Explicit work-start transition only; repeated calls preserve a single activation per workstream. */
export function activateDeferralsForWork(root:string,workstreamId:string):DeferralEvaluation[] {
  const permission=permissionStatus(root,workstreamId)
  if (!permission.allowed || !checkSeal(root,workstreamId).ok) throw new Error("activation requires an executable plan with applicable permission")
  const ledger=loadLedger(root)
  for (const item of evaluateDeferrals(root,workstreamId).filter(i=>i.affected)) {
    const path=join(ledger.rootDir,"deferral-activations",`${sha256Stable({decisionRef:item.decisionRef,workstreamId})}.json`)
    const value:Activation={schemaVersion:1,decision:item.decision,workstreamId,activatedAt:new Date().toISOString()}
    if (existsSync(path)) {
      const old=read<Activation>(path)
      immutable(path,{...value,activatedAt:old.activatedAt})
    } else {
      try { immutable(path,value) } catch(error) {
        if (!existsSync(path)) throw error
        immutable(path,{...value,activatedAt:read<Activation>(path).activatedAt})
      }
    }
  }
  return evaluateDeferrals(root,workstreamId)
}
export function recordDeferralResolution(root:string,d:DeferredDecision):DeferredDecision {
  validateDecision(d)
  const r=d.deferralResolution
  if (!validResolution(r)) throw new Error("valid resolution action and references required")
  const permission=permissionStatus(root,r.workstreamId)
  if (!permission.allowed || !permission.authorityId || permission.authorityId!==r.authorityRef || permission.revisionDigest!==r.revisionDigest) throw new Error("resolution requires current explicit authority and plan revision")
  const original=evaluateDeferrals(root,r.workstreamId).find(i=>i.decisionRef===r.decisionRef && i.affected)
  if (!original || !activations(root).some(a=>a.decision.id===r.decisionRef && a.workstreamId===r.workstreamId) || original.state==="unknown") throw new Error("resolution requires an activated, applicable, known deferral")
  if (original.decision.deferral?.response==="implement") throw new Error("hard requirements cannot be dismissed or re-deferred; supply current evidence")
  if (r.action==="re-deferred" && (!validDeferral(d) || d.id===r.decisionRef)) throw new Error("re-deferral requires a new linked commitment")
  return persistDecision(root,d)
}
/** Invoke immediately before marking affected work complete, not on ordinary turn close. */
export function assertDeferralsSatisfied(root:string,workstreamId:string):void {
  const blocking=evaluateDeferrals(root,workstreamId).filter(i=>i.affected && i.state!=="resolved")
  if (blocking.length) throw new Error(`Deferred obligations prevent completion: ${blocking.map(i=>`${i.decisionRef}: ${i.reasons.join("; ")}`).join(" | ")}`)
}
interface BacklogBase {
  candidates: {id:string; title:string; featureIds:string[]; optional:boolean}[]
  externalDiscovery: {status:"not-configured";reason:string}
  truncated: boolean
}
export function backlog(root:string,workstreamId:string):BacklogBase & {deferrals:DeferralEvaluation[]}
export function backlog(root:string):BacklogBase & {deferrals:DeferredDecision[]}
export function backlog(root:string,workstreamId?:string):BacklogBase & {deferrals:(DeferralEvaluation | DeferredDecision)[]} {
  const workstreams=listWorkstreams(root)
  return {
    candidates:workstreams.filter(w=>["draft","shaped","spec_review"].includes(w.status)).map(w=>({id:w.id,title:w.title,featureIds:w.featureIds,optional:true})),
    deferrals:workstreamId ? evaluateDeferrals(root,workstreamId) : listDeferredDecisions(root).filter(d=>d.deferral),
    externalDiscovery:{status:"not-configured" as const,reason:"No external planning provider selected; local discovery only"},
    truncated:false,
  }
}
