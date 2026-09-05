import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { randomUUID } from "node:crypto"
import { ledgerRoot, sha256Stable, loadLedger } from "../fs/load.js"
import { computeTreeDigest } from "../git/tree.js"
import { permissionStatus, planRevision } from "../permission/authority.js"
import { loadWorkstream } from "../workstream/load.js"
import { listWorkflowAttempts, selectedWorkflow } from "../workflows/index.js"
import type { ActivityEvent, ExecutionActivityProjection, ExecutionAssociation, ExecutionBlockReason, ExecutionPolicy, ExecutionStop } from "./types.js"
export * from "./types.js"
export { createActivityEmitter } from "./emitter.js"

const MAX_EVENTS = 256
const MAX_EVENT_IDS = 256
const MAX_STATE_BYTES = 64 * 1024
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,159}$/
interface RuntimeState {
  schemaVersion:1; registrationId:string; events:ActivityEvent[]; eventDigests:Record<string,string>
  totalSeen:number; dropped:number; duplicateCount:number; outOfOrderCount:number
  waiting?:{sequence:number;active:boolean;reason?:string;since?:string}
  sessions:Record<string,{maxSequence:number;gaps:Array<{from:number;to:number}>}>
  invocations:Record<string,{invocationId:string;sessionId:string;toolName?:string;startedAt:string;lastSequence:number;finished?:boolean;finishMissing?:boolean}>
}

function confined(root: string, child: string): string {
  const ledger = realpathSync(ledgerRoot(root)); const target = join(ledger, child)
  let existing = target; while (!existsSync(existing) && existing !== ledger) existing = dirname(existing)
  const rel = relative(ledger, realpathSync(existing))
  if (rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) throw new Error(`${child} storage escapes .spec-ledger through a symlink`)
  return target
}
function durableBase(root:string) { return confined(root,"executions") }
function runtimeBase(root:string) { return confined(root,"runtime/activity") }
function readJson<T>(path:string):T { return JSON.parse(readFileSync(path,"utf8")) as T }
function listJson<T>(dir:string):T[] { return existsSync(dir)?readdirSync(dir).filter(f=>f.endsWith(".json")).sort().map(f=>readJson<T>(join(dir,f))):[] }
function immutable(path:string,value:unknown) { mkdirSync(dirname(path),{recursive:true}); try{writeFileSync(path,`${JSON.stringify(value,null,2)}\n`,{encoding:"utf8",flag:"wx"})}catch(error){if((error as NodeJS.ErrnoException).code==="EEXIST")throw new Error("execution record id already exists");throw error} }
function replace(path:string,value:unknown) { mkdirSync(dirname(path),{recursive:true});const temp=`${path}.${process.pid}.${randomUUID()}.tmp`;writeFileSync(temp,`${JSON.stringify(value)}\n`);renameSync(temp,path) }
function assertSafe(value:string,label:string) { if(!SAFE.test(value))throw new Error(`${label} must be a bounded opaque identifier`) }

export function ensureActivityIgnored(root:string):void {
  const repo=loadLedger(root).repoRoot;const marker=join(repo,".git");let path:string
  if(existsSync(marker)&&statSync(marker).isDirectory())path=join(marker,"info/exclude")
  else if(existsSync(marker)){
    const match=readFileSync(marker,"utf8").match(/^gitdir:\s*(.+)$/m)
    if(!match)throw new Error("cannot locate git exclude file for activity runtime")
    const gitDir=realpathSync(resolve(repo,match[1]!.trim()))
    const commonFile=join(gitDir,"commondir")
    const commonDir=existsSync(commonFile)?realpathSync(resolve(gitDir,readFileSync(commonFile,"utf8").trim())):gitDir
    path=join(commonDir,"info/exclude")
  }
  else return
  const line=".spec-ledger/runtime/activity/"
  const current=existsSync(path)?readFileSync(path,"utf8"):""
  if(!current.split(/\r?\n/).includes(line)){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,`${current}${current&&!current.endsWith("\n")?"\n":""}${line}\n`)}
}

export function registerExecutionAssociation(root:string,args:{workstreamId:string;turnId:string;workflowAttemptId?:string;hostSessionRef:string}):ExecutionAssociation {
  assertSafe(args.hostSessionRef,"hostSessionRef")
  const ws=loadWorkstream(root,args.workstreamId);const turn=loadLedger(root).turns.find(t=>t.id===args.turnId)
  if(!turn||turn.status!=="open"||turn.intent.workstreamId!==args.workstreamId)throw new Error("execution registration requires an existing open workstream turn")
  if(args.workflowAttemptId){const snapshot=selectedWorkflow(root,args.workstreamId);const attempt=listWorkflowAttempts(root,args.workstreamId).find(a=>a.id===args.workflowAttemptId);if(!snapshot||!attempt||attempt.snapshotDigest!==snapshot.snapshotDigest)throw new Error("execution registration requires a current workflow attempt")}
  const existing=listJson<ExecutionAssociation>(join(durableBase(root),"registrations",args.workstreamId));const registrationId=`${args.workstreamId}/X-${String(existing.length+1).padStart(3,"0")}`
  const association:ExecutionAssociation={schemaVersion:1,registrationId,workstreamId:args.workstreamId,turnId:args.turnId,workflowAttemptId:args.workflowAttemptId??null,hostSessionRef:args.hostSessionRef,revisionDigest:planRevision(root,ws),sourceDigest:computeTreeDigest(root),registeredAt:new Date().toISOString(),provenance:"agent-reported"}
  immutable(join(durableBase(root),"registrations",args.workstreamId,`${registrationId.split("/").at(-1)}.json`),association);return association
}

export function listExecutionAssociations(root:string,workstreamId:string):ExecutionAssociation[]{return listJson(join(durableBase(root),"registrations",workstreamId))}
export function findExecutionAssociation(root:string,registrationId:string):ExecutionAssociation|undefined { const [ws]=registrationId.split("/");return ws?listExecutionAssociations(root,ws).find(a=>a.registrationId===registrationId):undefined }

export function writeExecutionPolicy(root:string,registrationId:string,input:{continuation?:Partial<ExecutionPolicy["continuation"]>;timeout?:Partial<ExecutionPolicy["timeout"]>;source:ExecutionPolicy["source"]}):ExecutionPolicy {
  const association=findExecutionAssociation(root,registrationId);if(!association)throw new Error("execution registration not found")
  if(input.source.kind!=="agent-reported"||!input.source.reference?.trim())throw new Error("execution policy requires agent-reported provenance")
  const previous=listJson<ExecutionPolicy>(join(durableBase(root),"policies",association.workstreamId,registrationId.split("/").at(-1)!)).at(-1)
  const continuation={requested:input.continuation?.requested??previous?.continuation.requested??false,minIntervalMs:input.continuation?.minIntervalMs??previous?.continuation.minIntervalMs??300000,retryLimit:input.continuation?.retryLimit??previous?.continuation.retryLimit??3,expiresAt:input.continuation?.expiresAt===undefined?previous?.continuation.expiresAt??null:input.continuation.expiresAt}
  const timeout={warningAfterMs:input.timeout?.warningAfterMs===undefined?previous?.timeout.warningAfterMs??null:input.timeout.warningAfterMs,enforceAfterMs:input.timeout?.enforceAfterMs===undefined?previous?.timeout.enforceAfterMs??null:input.timeout.enforceAfterMs}
  if(continuation.minIntervalMs<60000||continuation.minIntervalMs>86400000||continuation.retryLimit<0||continuation.retryLimit>10)throw new Error("continuation policy is outside bounded limits")
  if(continuation.expiresAt&&Number.isNaN(Date.parse(continuation.expiresAt)))throw new Error("continuation expiry must be an ISO timestamp")
  if(timeout.warningAfterMs!==null&&(timeout.warningAfterMs<1000||timeout.warningAfterMs>86400000))throw new Error("tool warning threshold is outside bounded limits")
  if(timeout.enforceAfterMs!==null&&(timeout.enforceAfterMs<1000||timeout.enforceAfterMs>86400000))throw new Error("tool timeout threshold is outside bounded limits")
  if(timeout.warningAfterMs!==null&&timeout.enforceAfterMs!==null&&timeout.enforceAfterMs<timeout.warningAfterMs)throw new Error("enforced timeout cannot precede its warning")
  const policy:ExecutionPolicy={schemaVersion:1,registrationId,revision:(previous?.revision??0)+1,recordedAt:new Date().toISOString(),continuation,timeout,source:input.source,userOptInVerified:false}
  immutable(join(durableBase(root),"policies",association.workstreamId,registrationId.split("/").at(-1)!,`P-${String(policy.revision).padStart(3,"0")}.json`),policy);return policy
}

export function writeExecutionStop(root:string,registrationId:string,reason:string,source:ExecutionStop["source"]):ExecutionStop {
  const association=findExecutionAssociation(root,registrationId);if(!association)throw new Error("execution registration not found")
  if(!reason.trim()||source.kind!=="agent-reported"||!source.reference?.trim())throw new Error("execution stop requires a reason and agent-reported provenance")
  const stop:ExecutionStop={schemaVersion:1,registrationId,reason,stoppedAt:new Date().toISOString(),source};immutable(join(durableBase(root),"stops",association.workstreamId,`${registrationId.split("/").at(-1)}.json`),stop);return stop
}

function emptyState(registrationId:string):RuntimeState{return{schemaVersion:1,registrationId,events:[],eventDigests:{},totalSeen:0,dropped:0,duplicateCount:0,outOfOrderCount:0,sessions:{},invocations:{}}}
function statePath(root:string,registrationId:string){return join(runtimeBase(root),`${registrationId.replace("/","--")}.json`)}

export function recordActivity(root:string,registrationId:string,event:ActivityEvent):{accepted:boolean;duplicate:boolean;retained:number;uncertain:boolean}{
  ensureActivityIgnored(root);const directory=runtimeBase(root);mkdirSync(directory,{recursive:true});const lock=join(directory,`${registrationId.replace("/","--")}.lock`)
  try{mkdirSync(lock)}catch(error){if((error as NodeJS.ErrnoException).code==="EEXIST"){
    try{writeFileSync(`${lock}.loss`,"delivery lost\n",{flag:"wx"})}catch(lossError){if((lossError as NodeJS.ErrnoException).code!=="EEXIST")throw lossError}
    return {accepted:false,duplicate:false,retained:0,uncertain:true}
  }throw error}
  try{return recordActivityLocked(root,registrationId,event)}finally{rmSync(lock,{recursive:true,force:true})}
}

function recordActivityLocked(root:string,registrationId:string,event:ActivityEvent):{accepted:boolean;duplicate:boolean;retained:number;uncertain:boolean}{
  const association=findExecutionAssociation(root,registrationId);if(!association)throw new Error("execution registration not found")
  assertSafe(event.eventId,"eventId");assertSafe(event.sessionId,"sessionId");if(event.invocationId)assertSafe(event.invocationId,"invocationId")
  if(event.sessionId!==association.hostSessionRef)throw new Error("activity session does not match its registered host session")
  if(!Number.isSafeInteger(event.sequence)||event.sequence<0||event.sequence>Number.MAX_SAFE_INTEGER)throw new Error("activity sequence must be a nonnegative safe integer")
  if(Number.isNaN(Date.parse(event.observedAt)))throw new Error("activity observedAt must be an ISO timestamp")
  if(["tool-start","tool-finish","tool-failure"].includes(event.kind)&&!event.invocationId)throw new Error("tool activity requires invocationId")
  const path=statePath(root,registrationId);const state=existsSync(path)?readJson<RuntimeState>(path):emptyState(registrationId);const digest=sha256Stable(event);const eventKey=`event:${event.eventId}`
  if(Object.prototype.hasOwnProperty.call(state.eventDigests,eventKey)){if(state.eventDigests[eventKey]!==digest)throw new Error("activity event id already belongs to different content");state.duplicateCount+=1;replace(path,state);return{accepted:false,duplicate:true,retained:state.events.length,uncertain:uncertain(state)}}
  const sessionKey=`session:${event.sessionId}`;const existingSession=Object.prototype.hasOwnProperty.call(state.sessions,sessionKey);const session=existingSession?state.sessions[sessionKey]!:{maxSequence:event.sequence,gaps:[]}
  if(existingSession&&event.sequence>session.maxSequence+1)session.gaps.push({from:session.maxSequence+1,to:event.sequence-1})
  else if(existingSession&&event.sequence<=session.maxSequence)state.outOfOrderCount+=1
  session.gaps=session.gaps.flatMap(gap=>event.sequence<gap.from||event.sequence>gap.to?[gap]:gap.from===gap.to?[]:event.sequence===gap.from?[{from:gap.from+1,to:gap.to}]:event.sequence===gap.to?[{from:gap.from,to:gap.to-1}]:[{from:gap.from,to:event.sequence-1},{from:event.sequence+1,to:gap.to}])
  if(session.gaps.length>128){session.gaps=session.gaps.slice(-128);state.dropped+=1}
  session.maxSequence=Math.max(session.maxSequence,event.sequence);state.sessions[sessionKey]=session;state.events.push(event);state.eventDigests[eventKey]=digest;state.totalSeen+=1
  const invocationKey=event.invocationId?`invocation:${event.invocationId}`:""
  if(event.kind==="tool-start"){const prior=state.invocations[invocationKey];if(prior&&!prior.finished)state.outOfOrderCount+=1;if(!prior||event.sequence>prior.lastSequence)state.invocations[invocationKey]={invocationId:event.invocationId!,sessionId:event.sessionId,...(event.toolName?{toolName:event.toolName}:{}),startedAt:event.observedAt,lastSequence:event.sequence}}
  if(event.kind==="tool-finish"||event.kind==="tool-failure"){const invocation=state.invocations[invocationKey];if(invocation&&event.sequence>invocation.lastSequence){invocation.finished=true;invocation.lastSequence=event.sequence}else state.outOfOrderCount+=1}
  if((event.kind==="waiting-user"||event.kind==="resumed")&&(!state.waiting||event.sequence>state.waiting.sequence))state.waiting={sequence:event.sequence,active:event.kind==="waiting-user",...(event.reason?{reason:event.reason}:{}),since:event.observedAt}
  if(event.kind==="session-stop")for(const invocation of Object.values(state.invocations))if(!invocation.finished)invocation.finishMissing=true
  while(state.events.length>MAX_EVENTS){const removed=state.events.shift()!;delete state.eventDigests[`event:${removed.eventId}`];state.dropped+=1}
  const ids=Object.keys(state.eventDigests);while(ids.length>MAX_EVENT_IDS)delete state.eventDigests[ids.shift()!]
  while(Object.keys(state.sessions).length>16){delete state.sessions[Object.keys(state.sessions)[0]!];state.dropped+=1}
  while(Object.keys(state.invocations).length>128){const entries=Object.entries(state.invocations).sort((a,b)=>a[1].lastSequence-b[1].lastSequence);const removable=entries.find(([,invocation])=>invocation.finished)??entries[0]!;delete state.invocations[removable[0]];state.dropped+=1;state.outOfOrderCount+=1}
  while(Buffer.byteLength(`${JSON.stringify(state,null,2)}\n`)>MAX_STATE_BYTES&&state.events.length){const removed=state.events.shift()!;delete state.eventDigests[`event:${removed.eventId}`];state.dropped+=1}
  while(Buffer.byteLength(`${JSON.stringify(state,null,2)}\n`)>MAX_STATE_BYTES&&Object.keys(state.invocations).length){const oldest=Object.entries(state.invocations).sort((a,b)=>a[1].lastSequence-b[1].lastSequence)[0]!;delete state.invocations[oldest[0]];state.dropped+=1;state.outOfOrderCount+=1}
  replace(path,state);return{accepted:true,duplicate:false,retained:state.events.length,uncertain:uncertain(state)}
}
function uncertain(state:RuntimeState){return state.outOfOrderCount>0||state.dropped>0||Object.values(state.sessions).some(s=>s.gaps.length>0)||Object.values(state.invocations).some(i=>i.finishMissing)}

export function projectExecution(root:string,workstreamId:string,completion:{eligible:boolean;reasons:string[];remaining?:string[]},registrationId?:string):ExecutionActivityProjection {
  const association=registrationId?findExecutionAssociation(root,registrationId)??null:listExecutionAssociations(root,workstreamId).at(-1)??null
  const emptySignals={retained:0,totalSeen:0,dropped:0,duplicateCount:0,outOfOrderCount:0,gaps:[],lastObservedAt:null,recentEvents:[]}
  if(!association)return{association:null,state:"unregistered",signals:emptySignals,inflightInvocations:[],waiting:{active:false},continuation:{requested:false,effective:false,userOptInVerified:false,minIntervalMs:300000,retryLimit:3,expiresAt:null,attempts:[],remainingRetries:3,readiness:"not-requested",reasons:["no-registration"],guidance:completion.reasons,prompt:null},timeout:{warningAfterMs:null,enforceAfterMs:null,warnings:[],enforcement:"off",reasons:[]},hostCapabilities:{verified:false,liveness:false,resume:false,cancelTool:false,ownedProcess:false},stop:{stopped:false}}
  const path=statePath(root,association.registrationId);const runtime=existsSync(path)?readJson<RuntimeState>(path):emptyState(association.registrationId);if(existsSync(join(runtimeBase(root),`${association.registrationId.replace("/","--")}.lock.loss`)))runtime.dropped+=1
  const policy=listJson<ExecutionPolicy>(join(durableBase(root),"policies",workstreamId,association.registrationId.split("/").at(-1)!)).at(-1)
  const stoppedPath=join(durableBase(root),"stops",workstreamId,`${association.registrationId.split("/").at(-1)}.json`);const stopped=existsSync(stoppedPath)?readJson<ExecutionStop>(stoppedPath):undefined
  const events=[...runtime.events].sort((a,b)=>b.sequence-a.sequence||b.observedAt.localeCompare(a.observedAt));const latest=events[0]
  const lastWaiting=[...events].find(event=>event.kind==="waiting-user"||event.kind==="resumed");const waiting=runtime.waiting?{active:runtime.waiting.active,reason:runtime.waiting.reason,since:runtime.waiting.since}:lastWaiting?.kind==="waiting-user"?{active:true,reason:lastWaiting.reason,since:lastWaiting.observedAt}:{active:false}
  const inflight=Object.values(runtime.invocations).filter(i=>!i.finished).map(i=>({invocationId:i.invocationId,...(i.toolName?{toolName:i.toolName}:{}),startedAt:i.startedAt,lastSequence:i.lastSequence,status:i.finishMissing?"finish-missing" as const:"inflight" as const}))
  const now=Date.now();const warning=policy?.timeout.warningAfterMs??null;const warnings=warning===null?[]:inflight.map(i=>({invocationId:i.invocationId,elapsedMs:Math.max(0,now-Date.parse(i.startedAt)),thresholdMs:warning})).filter(item=>item.elapsedMs>=item.thresholdMs)
  const reasons:ExecutionBlockReason[]=[];const permission=permissionStatus(root,workstreamId)
  if(!policy?.continuation.requested)reasons.push("not-requested");else reasons.push("user-opt-in-unverified")
  if(policy?.continuation.requested)reasons.push("host-resume-unsupported","host-liveness-unsupported")
  if(!permission.allowed)reasons.push("permission-revoked");if(completion.eligible)reasons.push("verified-complete");else reasons.push("remaining-work")
  if(stopped)reasons.push("explicitly-stopped");if(policy?.continuation.expiresAt&&Date.parse(policy.continuation.expiresAt)<=now)reasons.push("expired")
  if(policy?.continuation.requested&&policy.continuation.retryLimit===0)reasons.push("retry-exhausted")
  if(waiting.active)reasons.push("waiting-for-user");if(inflight.length)reasons.push("inflight-invocation");if(uncertain(runtime)||!latest)reasons.push("activity-uncertain")
  const requested=policy?.continuation.requested??false;const blocked=reasons.some(reason=>["permission-revoked","explicitly-stopped","expired","retry-exhausted","waiting-for-user","inflight-invocation","activity-uncertain"].includes(reason));const readiness=completion.eligible?"complete" as const:!requested?"not-requested" as const:blocked?"blocked" as const:"unavailable" as const
  const state=completion.eligible?"complete" as const:stopped?"stopped" as const:waiting.active?"waiting-user" as const:uncertain(runtime)||!latest?"uncertain" as const:"active" as const
  const gaps=Object.values(runtime.sessions).flatMap(session=>session.gaps)
  const spec=loadWorkstream(root,workstreamId)
  const guidance=[...new Set([...(completion.remaining??[]),...completion.reasons])]
  const pause=stopped||!permission.allowed||waiting.active
  const prompt=[
    `Task ${association.turnId} in ${workstreamId}: ${spec.title}.`,
    `Read the preserved spec ${spec.specPath??spec.seal?.snapshotPath??"(no preserved spec available)"}; current revision ${planRevision(root,spec)}. Registered revision ${association.revisionDigest}.`,
    completion.eligible?"The completion gate is satisfied; do not restart completed work.":pause?"Pause execution: honor the explicit stop, current permission and any pending user question before continuing.":"Continue the registered task end to end within its current permission. Inspect current method prerequisites, address the missing outcomes, verify the result and use the completion gate.",
    ...guidance.map(reason=>`Remaining: ${reason}`),
    "This is guidance only. No agent was resumed and no host action was dispatched.",
  ].join("\n")
  return{association,state,signals:{retained:runtime.events.length,totalSeen:runtime.totalSeen,dropped:runtime.dropped,duplicateCount:runtime.duplicateCount,outOfOrderCount:runtime.outOfOrderCount,gaps,lastObservedAt:latest?.observedAt??null,recentEvents:events},inflightInvocations:inflight,waiting,
    continuation:{requested,effective:false,userOptInVerified:false,minIntervalMs:policy?.continuation.minIntervalMs??300000,retryLimit:policy?.continuation.retryLimit??3,expiresAt:policy?.continuation.expiresAt??null,attempts:[],remainingRetries:policy?.continuation.retryLimit??3,readiness,reasons:[...new Set(reasons)],guidance,prompt},
    timeout:{warningAfterMs:warning,enforceAfterMs:policy?.timeout.enforceAfterMs??null,warnings,enforcement:policy?.timeout.enforceAfterMs?"unsupported":"off",reasons:policy?.timeout.enforceAfterMs?["Host tool cancellation is unavailable.","Invocation ownership and liveness are unverified."]:[]},hostCapabilities:{verified:false,liveness:false,resume:false,cancelTool:false,ownedProcess:false},stop:stopped?{stopped:true,reason:stopped.reason,stoppedAt:stopped.stoppedAt}:{stopped:false}}
}
