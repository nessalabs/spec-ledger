import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, lstatSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { sha256Stable } from "../fs/load.js"
import { computeSpecDigest } from "../workstream/load.js"
import type { Workstream } from "../types.js"
import { derivedEntityId, isEntityId } from "./index.js"

type Json = null | boolean | number | string | Json[] | { [key:string]: Json }
type Obj = { [key:string]: Json }
type Files = Map<string,Buffer>
interface Entity { kind:string; oldId:string; path:string; value:Obj; uuid:string; owner?:string }
interface Origin { label:string; commit:string; files:Files; entities:Entity[]; ids:Map<string,string>; paths:Map<string,string>; slices:Map<string,Map<string,string>>; findings:Map<string,Map<string,string>> }
export interface MigrationOptions { root:string; ours:string; theirs:string; base:string; stage:string; resolutions?:Record<string,Json>; reconciliations?:Array<{path:string;pointer:string[];before:Json;after:Json;reason:string}> }
const entityKinds=new Set(["claims","bindings","turns","workstreams","proposed-claims","reviews","decisions","sources","attachments","probes","flows","authority","learnings","tenets","themes","automation-events","align-waivers"])
const hash=(bytes:Buffer|string)=>createHash("sha256").update(bytes).digest("hex")
const object=(value:unknown):value is Obj=>!!value&&typeof value==="object"&&!Array.isArray(value)
function json(bytes:Buffer,path:string):Json { try{return JSON.parse(bytes.toString("utf8"))}catch{throw new Error(`Invalid JSON in migration origin: ${path}`)} }
function filesAt(directory:string,prefix=""):Files {
  const files:Files=new Map()
  try { if(lstatSync(directory).isSymbolicLink())throw new Error(`Migration refuses symbolic links: ${directory}`) } catch(error) { if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error }
  if(!existsSync(directory))return files
  for(const name of readdirSync(directory).sort()){
    const path=join(directory,name), rel=prefix?`${prefix}/${name}`:name, stat=lstatSync(path)
    if(stat.isSymbolicLink())throw new Error(`Migration refuses symbolic links: ${rel}`)
    if(stat.isDirectory())for(const [k,v] of filesAt(path,rel))files.set(k,v)
    else if(stat.isFile())files.set(rel,readFileSync(path))
  }
  return files
}
function source(root:string,ref:string,directory:string):{commit:string;files:Files} {
  const commit=execFileSync("git",["rev-parse","--verify","--end-of-options",`${ref}^{commit}`],{cwd:root,encoding:"utf8"}).trim()
  if(!/^[0-9a-f]{40,64}$/.test(commit))throw new Error("Invalid origin commit")
  mkdirSync(directory,{recursive:true})
  if(!existsSync(join(directory,".spec-ledger"))){
    const archive=execFileSync("git",["archive",commit,".spec-ledger","docs"],{cwd:root,maxBuffer:128*1024*1024})
    execFileSync("tar",["-x","-C",directory],{input:archive,maxBuffer:128*1024*1024})
  }
  return {commit,files:filesAt(directory)}
}
function inventory(files:Files):Entity[] {
  const out:Entity[]=[]
  for(const [path,bytes] of files){
    if(!path.startsWith(".spec-ledger/")||!path.endsWith(".json"))continue
    const kind=path.split("/")[1]!,value=json(bytes,path)
    if(!entityKinds.has(kind)||!object(value)||typeof value.id!=="string"||path.includes(".seals/"))continue
    out.push({kind,oldId:value.id,path,value,uuid:"",owner:typeof value.workstreamId==="string"?value.workstreamId:undefined})
  }
  return out
}
function prepare(label:string,commit:string,files:Files,base:Origin):Origin {
  const origin:Origin={label,commit,files,entities:inventory(files),ids:new Map(),paths:new Map(),slices:new Map(),findings:new Map()}
  for(const e of origin.entities){
    const ancestor=base.entities.find(b=>b.path===e.path&&b.kind===e.kind&&b.oldId===e.oldId)
    e.uuid=isEntityId(e.oldId)?e.oldId:derivedEntityId("spec-ledger:migration",`${ancestor?base.commit:commit}:${e.kind}:${e.oldId}`)
    const prior=origin.ids.get(e.oldId)
    if(prior&&prior!==e.uuid)throw new Error(`Ambiguous entity identity in ${label}: ${e.oldId}`)
    origin.ids.set(e.oldId,e.uuid)
    if(e.kind==="workstreams"){
      const slices=new Map<string,string>();origin.slices.set(e.oldId,slices)
      if(Array.isArray(e.value.suggestedSlices))for(const s of e.value.suggestedSlices){
        if(object(s)&&typeof s.id==="string")slices.set(s.id,isEntityId(s.id)?s.id:derivedEntityId("spec-ledger:migration:slice",`${e.uuid}:${s.id}`))
      }
    }
    if(e.kind==="reviews"){
      const findings=new Map<string,string>();origin.findings.set(e.oldId,findings)
      if(Array.isArray(e.value.findings))for(const f of e.value.findings)if(object(f)&&typeof f.id==="string")findings.set(f.id,isEntityId(f.id)?f.id:derivedEntityId("spec-ledger:migration:finding",`${e.uuid}:${f.id}`))
    }
  }
  for(const e of origin.entities){
    // The collection determines the identity even when legacy filenames used a different spelling.
    const parts=e.path.split("/");parts[parts.length-1]=`${e.uuid}.json`
    for(let i=0;i<parts.length-1;i++)parts[i]=origin.ids.get(parts[i]!)??parts[i]!
    origin.paths.set(e.path,parts.join("/"))
  }
  for(const path of files.keys()){
    if(origin.paths.has(path))continue
    const parts=path.split("/").map(part=>{
      for(const [id,uuid] of origin.ids){
        if(part===id)return uuid
        if(part.startsWith(`${id}.`))return uuid+part.slice(id.length)
        if(part.startsWith(`${id}-`))return uuid+part.slice(id.length)
      }
      return part
    });origin.paths.set(path,parts.join("/"))
  }
  return origin
}
function ownerFor(origin:Origin,path:string,value?:Obj,allowPath=true):string|undefined {
  if(typeof value?.id==="string"&&origin.entities.some(e=>e.kind==="workstreams"&&e.oldId===value.id))return value.id
  if(typeof value?.workstreamId==="string")return value.workstreamId
  if(object(value?.intent)&&typeof value.intent.workstreamId==="string")return value.intent.workstreamId
  if(typeof value?.contextWorkstreamId==="string")return value.contextWorkstreamId
  if(!allowPath)return undefined
  if(path.includes("/workstreams/"))return origin.entities.find(e=>e.kind==="workstreams"&&(e.path===path||path.includes(`/${e.oldId}.seals/`)))?.oldId
  const turn=typeof value?.turnId==="string"?value.turnId:path.split("/").find(p=>origin.entities.some(e=>e.kind==="turns"&&e.oldId===p))
  const intent=origin.entities.find(e=>e.kind==="turns"&&e.oldId===turn)?.value.intent
  if(object(intent)&&typeof intent.workstreamId==="string")return intent.workstreamId
  return origin.entities.find(e=>e.kind==="workstreams"&&typeof e.value.specPath==="string"&&path.startsWith(dirname(e.value.specPath)+"/"))?.oldId
}
function replaceKnown(text:string,mapping:Map<string,string>):string {
  // Literal spans, longest first, with identifier boundaries. Never replace a counter fragment inside another ID.
  const keys=[...mapping.keys()].filter(k=>k!==mapping.get(k)).sort((a,b)=>b.length-a.length)
  if(!keys.length)return text
  const escaped=keys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"))
  const pattern=new RegExp(`(?<![A-Za-z0-9_])(?:${escaped.join("|")})(?![A-Za-z0-9_])`,"g")
  return text.replace(pattern,key=>mapping.get(key)!)
}
function transform(origin:Origin,value:Json,path:string,owner?:string,review?:string,key=""):Json {
  if(typeof value==="string"){
    if(key==="resolvesFindingIds") {
      const [reviewId,findingId]=value.split("#")
      const migratedReview=origin.ids.get(reviewId!),migratedFinding=origin.findings.get(reviewId!)?.get(findingId!)
      if(migratedReview&&migratedFinding)return `${migratedReview}#${migratedFinding}`
    }

    if(origin.paths.has(value))return origin.paths.get(value)!
    if(origin.ids.has(value))return origin.ids.get(value)!
    const local=owner?origin.slices.get(owner):undefined
    const finding=review?origin.findings.get(review):undefined
    if(finding?.has(value))return key==="resolvesFindingIds"&&review ? `${origin.ids.get(review)}#${finding.get(value)}` : finding.get(value)!
    if(local?.has(value))return local.get(value)!
    let text=replaceKnown(value,origin.paths)
    text=replaceKnown(text,origin.ids)
    if(local)text=replaceKnown(text,local)
    if(finding)text=replaceKnown(text,finding)
    return text
  }
  if(Array.isArray(value))return value.map(v=>transform(origin,v,path,owner,review,key))
  if(!object(value))return value
  owner=ownerFor(origin,path,value,false)??owner??ownerFor(origin,path,value)
  if(typeof value.id==="string"&&origin.findings.has(value.id))review=value.id
  const targetReview=typeof value.resolvesReviewId==="string"?value.resolvesReviewId:review
  const out:Obj={}
  for(const [k,v] of Object.entries(value)){
    const fieldReview=k==="resolvesFindingIds"?targetReview:review
    const newKey=origin.ids.get(k)??(owner?origin.slices.get(owner)?.get(k):undefined)??replaceKnown(k,owner?origin.slices.get(owner)??new Map():new Map())
    out[newKey]=transform(origin,v,path,owner,fieldReview,k)
  }
  return out
}
function mergeJson(base:Json|undefined,ours:Json|undefined,theirs:Json|undefined,path:string,resolutions:Record<string,Json>):Json|undefined {
  const equal=(a:Json|undefined,b:Json|undefined)=>JSON.stringify(a)===JSON.stringify(b)
  if(equal(ours,theirs))return ours
  if(equal(ours,base))return theirs
  if(equal(theirs,base))return ours
  if(Object.hasOwn(resolutions,path))return resolutions[path]
  if(object(ours)&&object(theirs)){
    const out:Obj={};for(const key of new Set([...Object.keys(ours),...Object.keys(theirs)])){
      const value=mergeJson(object(base)?base[key]:undefined,ours[key],theirs[key],`${path}/${key}`,resolutions)
      if(value!==undefined)out[key]=value
    }return out
  }
  if(Array.isArray(ours)&&Array.isArray(theirs)){
    const all=[...ours,...theirs]
    if(all.every(v=>typeof v==="string")&&(!Array.isArray(base)||base.every(v=>ours.includes(v)&&theirs.includes(v))))return [...new Set(all)]
    if(all.every(v=>object(v)&&typeof v.id==="string")){
      const ids=[...new Set(all.map(v=>(v as Obj).id as string))]
      return ids.map(id=>mergeJson(Array.isArray(base)?base.find(v=>object(v)&&v.id===id):undefined,ours.find(v=>object(v)&&v.id===id),theirs.find(v=>object(v)&&v.id===id),`${path}/${id}`,resolutions)!).filter(v=>v!==undefined)
    }
  }
  throw new Error(`Conflicting ancestor edits require explicit reconciliation: ${path}`)
}
function transformed(origin:Origin):Files {
  const output:Files=new Map()
  for(const [path,bytes]of origin.files){
    const target=origin.paths.get(path)!
    let result=bytes
    if(path.endsWith(".json")){
      let value=transform(origin,json(bytes,path),path)
      const entity=origin.entities.find(e=>e.path===path)
      if(object(value)&&entity){
        value.migration={origins:{[origin.commit]:{path,id:entity.oldId,sha256:hash(bytes)}},historical:value.status!=="open"}
        if(entity.kind==="decisions"&&value.sequence===undefined){const ordinal=entity.oldId.match(/D-(\d+)$/)?.[1];if(ordinal)value.sequence=Number(ordinal)}
      }
      result=Buffer.from(JSON.stringify(value,null,2)+"\n")
    }else if(path.startsWith("docs/")&&!path.includes("/evidence/")&&/\.(md|txt|mmd|jsonl)$/.test(path))result=Buffer.from(transform(origin,bytes.toString("utf8"),path,ownerFor(origin,path)) as string)
    if(output.has(target)&&!output.get(target)!.equals(result))throw new Error(`Migration path collision: ${target}`)
    output.set(target,result)
  }
  return output
}
function rewriteDigests(value:Json,digests:Map<string,string>):Json {
  if(typeof value==="string")return digests.get(value)??value
  if(Array.isArray(value))return value.map(v=>rewriteDigests(v,digests))
  if(!object(value))return value
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==="migration"?v:rewriteDigests(v,digests)]))
}
function refreshReferences(output:Files,origins:Origin[]):void {
  const digests=new Map<string,string>()
  for(const origin of origins)for(const [path,bytes]of origin.files){
    const target=origin.paths.get(path)!,next=output.get(target)
    if(next&&path.endsWith(".md"))digests.set(hash(bytes),hash(next))
    if(!path.includes(".seals/")||!path.endsWith(".json")||!next)continue
    const old=json(bytes,path),snap=json(next,target)
    if(object(old)&&object(snap)&&object(snap.body)&&typeof old.specDigest==="string"){
      const digest=sha256Stable(snap.body);digests.set(old.specDigest,digest);snap.specDigest=digest
      output.set(target,Buffer.from(JSON.stringify(snap,null,2)+"\n"))
    }
  }
  for(const origin of origins)for(const e of origin.entities.filter(e=>e.kind==="workstreams")){
    const target=origin.paths.get(e.path)!,next=json(output.get(target)!,target)
    if(!object(next))continue
    const oldDoc=typeof e.value.specPath==="string"?origin.files.get(e.value.specPath):undefined
    const newDoc=typeof next.specPath==="string"?output.get(next.specPath):undefined
    const oldRevision=sha256Stable({specDigest:computeSpecDigest(e.value as unknown as Workstream),docDigest:oldDoc?hash(oldDoc):null})
    const newRevision=sha256Stable({specDigest:computeSpecDigest(next as unknown as Workstream),docDigest:newDoc?hash(newDoc):null})
    digests.set(oldRevision,newRevision)
  }
  for(const [path,bytes]of output){
    if(!path.endsWith(".json"))continue
    const value=json(bytes,path)
    // Source fingerprints and historical run outcomes are never refreshed by migration.
    output.set(path,Buffer.from(JSON.stringify(rewriteDigests(value,digests),null,2)+"\n"))
  }
}
export function validateMigratedFiles(files:Files):void {
  const entities=inventory(files),ids=new Map<string,Entity>()
  for(const e of entities){
    if(!isEntityId(e.oldId))throw new Error(`Legacy entity identity remains: ${e.path}`)
    if(ids.has(e.oldId))throw new Error(`Duplicate entity UUID: ${e.oldId}`)
    ids.set(e.oldId,e)
    if(!e.path.endsWith(`/${e.oldId}.json`))throw new Error(`Entity path mismatch: ${e.path}`)
  }
  const requireRef=(id:Json|undefined,kind:string,location:string)=>{
    if(typeof id!=="string"||!isEntityId(id)||ids.get(id)?.kind!==kind)throw new Error(`Dangling ${kind} reference at ${location}: ${String(id)}`)
  }
  for(const e of entities){
    const v=e.value
    if(typeof v.turnId==="string")requireRef(v.turnId,"turns",e.path)
    if(typeof v.workstreamId==="string")requireRef(v.workstreamId,"workstreams",e.path)
    if(e.kind==="bindings")requireRef(v.claimId,"claims",e.path)
    if(e.kind==="authority") {
      if(v.targetId!==undefined)requireRef(v.targetId,"authority",e.path)
      if(Array.isArray(v.supersedes))for(const id of v.supersedes)requireRef(id,"authority",e.path)
    }
    if(e.kind==="learnings") {
      if(Array.isArray(v.supersedes))for(const id of v.supersedes)requireRef(id,"learnings",e.path)
      if(Array.isArray(v.supersedesTenetIds))for(const id of v.supersedesTenetIds)requireRef(id,"tenets",e.path)
    }
    if(e.kind==="claims"&&object(v.links))for(const key of ["dependsOn","related"])if(Array.isArray(v.links[key]))for(const id of v.links[key])requireRef(id,"claims",e.path)
    if(e.kind==="attachments")for(const [key,kind] of Object.entries({decisionId:"decisions",sourceId:"sources",probeId:"probes",reviewId:"reviews",flowId:"flows"}))if(v[key]!==undefined)requireRef(v[key],kind,e.path)
    if(e.kind==="reviews") {
      if(v.supersedesReviewId!==undefined)requireRef(v.supersedesReviewId,"reviews",e.path)
      if(Array.isArray(v.waiverIds))for(const id of v.waiverIds)requireRef(id,"align-waivers",e.path)
      if(Array.isArray(v.resolvesFindingIds))for(const ref of v.resolvesFindingIds) {
        if(typeof ref!=="string")throw new Error(`Invalid finding reference: ${e.path}`)
        const [reviewId,findingId]=ref.split("#");requireRef(reviewId,"reviews",e.path)
        const findings=ids.get(reviewId!)!.value.findings
        if(!Array.isArray(findings)||!findings.some(f=>object(f)&&f.id===findingId))throw new Error(`Dangling finding reference: ${e.path}`)
      }

      if(v.resolvesReviewId!==undefined)requireRef(v.resolvesReviewId,"reviews",e.path)
      if(Array.isArray(v.findings))for(const finding of v.findings)if(object(finding)&&finding.claimId!==undefined){const kind=ids.get(finding.claimId as string)?.kind;if(kind!=="claims"&&kind!=="proposed-claims")throw new Error(`Dangling review claim reference: ${e.path}`)}
    }
    if(e.kind==="workstreams") {
      if(Array.isArray(v.proposedClaimIds))for(const id of v.proposedClaimIds)requireRef(id,"proposed-claims",e.path)
      if(Array.isArray(v.postSealAmends))for(const amend of v.postSealAmends)if(object(amend)) {
        if(amend.turnId!==undefined)requireRef(amend.turnId,"turns",e.path)
        if(amend.decisionId!==undefined)requireRef(amend.decisionId,"decisions",e.path)
      }
      if(v.themeId!==undefined)requireRef(v.themeId,"themes",e.path)
      if(v.specBreakReviewId!==undefined)requireRef(v.specBreakReviewId,"reviews",e.path)
      if(Array.isArray(v.suggestedSlices))for(const slice of v.suggestedSlices)if(object(slice)) {
        if(slice.doneTurnId!==undefined)requireRef(slice.doneTurnId,"turns",e.path)
        if(slice.specBreakReviewId!==undefined)requireRef(slice.specBreakReviewId,"reviews",e.path)
        if(slice.codeBreakReviewId!==undefined)requireRef(slice.codeBreakReviewId,"reviews",e.path)
        if(Array.isArray(slice.expectedClaimIds))for(const id of slice.expectedClaimIds){const kind=ids.get(id as string)?.kind;if(kind!=="claims"&&kind!=="proposed-claims")throw new Error(`Dangling expected claim reference: ${e.path}`)}
      }
    }

    if(e.kind==="turns"&&object(v.intent)&&v.intent.workstreamId){
      requireRef(v.intent.workstreamId,"workstreams",e.path)
      if(v.intent.sliceId){const ws=ids.get(v.intent.workstreamId as string)!.value; if(!Array.isArray(ws.suggestedSlices)||!ws.suggestedSlices.some(s=>object(s)&&s.id===(v.intent as Obj).sliceId))throw new Error(`Dangling slice reference: ${e.path}`)}
    }
    if(e.kind==="workstreams"){
      if(typeof v.specPath==="string"&&!files.has(v.specPath))throw new Error(`Missing migrated spec: ${v.specPath}`)
      if(object(v.seal)&&typeof v.seal.snapshotPath==="string"){
        const path=`.spec-ledger/${v.seal.snapshotPath}`,bytes=files.get(path)
        if(!bytes)throw new Error(`Missing migrated snapshot: ${path}`)
        const snap=json(bytes,path)
        if(!object(snap)||!object(snap.body)||snap.specDigest!==sha256Stable(snap.body)||v.seal.specDigest!==snap.specDigest)throw new Error(`Invalid migrated snapshot digest: ${path}`)
      }
      if(Array.isArray(v.suggestedSlices))for(const s of v.suggestedSlices)if(!object(s)||!isEntityId(s.id))throw new Error(`Invalid slice identity: ${e.path}`)
      if(object(v.acceptanceClaimIds))for(const c of Object.values(v.acceptanceClaimIds))if(Array.isArray(c))for(const id of c)requireRef(id,"claims",e.path)
    }
  }
}
function reconcileReferences(files:Files, repairs:NonNullable<MigrationOptions["reconciliations"]>) {
  for(const repair of repairs) {
    if(!repair.reason.trim()||!repair.pointer.length||repair.pointer.some(k=>["__proto__","constructor","prototype"].includes(k)))throw new Error("Reconciliation requires a safe pointer and attributed reason")
    const bytes=files.get(repair.path);if(!bytes)throw new Error(`Reconciliation file missing: ${repair.path}`)
    const value=json(bytes,repair.path);let parent=value
    for(const key of repair.pointer.slice(0,-1)){if(!object(parent))throw new Error("Invalid reconciliation pointer");parent=parent[key]!}
    const key=repair.pointer.at(-1)!;if(!object(parent)||sha256Stable(parent[key])!==sha256Stable(repair.before))throw new Error(`Reconciliation precondition failed: ${repair.path}`)
    parent[key]=repair.after
    files.set(repair.path,Buffer.from(JSON.stringify(value,null,2)+"\n"))
  }
}
/** Offline migration stages both origin histories before any live replacement. Original commits remain recoverable. */
export function stageIdentityMigration(options:MigrationOptions):{manifestPath:string;files:number;entities:number} {
  const root=resolve(options.root),stage=resolve(options.stage)
  if(stage===root||stage.startsWith(root+"/"))throw new Error("Migration staging must be outside the live checkout")
  mkdirSync(stage,{recursive:true})
  const commitOf=(ref:string)=>execFileSync("git",["rev-parse","--verify","--end-of-options",`${ref}^{commit}`],{cwd:root,encoding:"utf8"}).trim()
  filesAt(stage) // Refuse redirected staged files before writes.
  const descriptor=join(stage,"inputs.json"),requested={ours:commitOf(options.ours),theirs:commitOf(options.theirs),base:commitOf(options.base)}
  if(existsSync(descriptor)&&JSON.stringify(JSON.parse(readFileSync(descriptor,"utf8")))!==JSON.stringify(requested))throw new Error("Staging directory belongs to different migration inputs")
  writeFileSync(descriptor,JSON.stringify(requested)+"\n")
  const b=source(root,requested.base,join(stage,"originals","base"))
  const empty:Origin={label:"base",commit:b.commit,files:b.files,entities:inventory(b.files),ids:new Map(),paths:new Map(),slices:new Map(),findings:new Map()}
  const base=prepare("base",b.commit,b.files,empty)
  const o=source(root,requested.ours,join(stage,"originals","ours")),t=source(root,requested.theirs,join(stage,"originals","theirs"))
  const ours=prepare("ours",o.commit,o.files,base),theirs=prepare("theirs",t.commit,t.files,base)
  const origins=[base,ours,theirs],bf=transformed(base),of=transformed(ours),tf=transformed(theirs),output:Files=new Map()
  const conflicts:string[]=[]
  for(const path of new Set([...bf.keys(),...of.keys(),...tf.keys()])){
    const b=bf.get(path),o=of.get(path),t=tf.get(path)
    const equal=(x?:Buffer,y?:Buffer)=>x===undefined?y===undefined:y!==undefined&&x.equals(y)
    let bytes:Buffer|undefined
    try{
      if(equal(o,t))bytes=o
      else if(equal(o,b))bytes=t
      else if(equal(t,b))bytes=o
      else if(path.endsWith(".json")){
        const value=mergeJson(b?json(b,path):undefined,o?json(o,path):undefined,t?json(t,path):undefined,path,options.resolutions??{})
        if(value!==undefined)bytes=Buffer.from(JSON.stringify(value,null,2)+"\n")
      }else if(b&&o&&t&&path.endsWith(".md")){
        const mergeDir=join(stage,"merge");mkdirSync(mergeDir,{recursive:true})
        for(const [label,content]of [["base",b],["ours",o],["theirs",t]] as const)writeFileSync(join(mergeDir,label),content)
        bytes=execFileSync("git",["merge-file","-p",join(mergeDir,"ours"),join(mergeDir,"base"),join(mergeDir,"theirs")],{maxBuffer:32*1024*1024})
      }else throw new Error(`Conflicting file requires explicit reconciliation: ${path}`)
      if(bytes)output.set(path,bytes)
    }catch(error){conflicts.push(error instanceof Error?error.message:String(error))}
  }
  reconcileReferences(output,options.reconciliations ?? [])
  const manifest={schemaVersion:1,reconciliations:options.reconciliations ?? [],id:derivedEntityId("spec-ledger:migration-run",`${base.commit}:${ours.commit}:${theirs.commit}`),origins:origins.map(origin=>({label:origin.label,commit:origin.commit,entities:origin.entities.map(e=>({kind:e.kind,oldId:e.oldId,id:e.uuid,path:e.path,sha256:hash(origin.files.get(e.path)!)})),paths:Object.fromEntries(origin.paths)})),resolutions:options.resolutions??{},conflicts,publication:"staged",historicalEvidence:"Original source fingerprints and outcomes remain historical. A migration is not a test run or approval."}
  const manifestPath=join(stage,"manifest.json");writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n")
  if(conflicts.length)throw new Error(`Migration needs reconciliation (${conflicts.length}); see ${manifestPath}: ${conflicts.slice(0,5).join("; ")}`)
  refreshReferences(output,origins)
  validateMigratedFiles(output)
  const outputDir=join(stage,"output")
  if(existsSync(outputDir))rmSync(outputDir,{recursive:true})
  for(const [path,bytes]of output){const target=join(outputDir,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes)}
  writeFileSync(join(stage,"ready.json"),JSON.stringify({manifestSha256:hash(readFileSync(manifestPath)),files:[...output].map(([path,bytes])=>({path,sha256:hash(bytes)}))},null,2)+"\n")
  return {manifestPath,files:output.size,entities:inventory(output).length}
}
/** Atomic ledger swap with a recovery journal; documentation publication is retryable and hash-checked. */
export function publishIdentityMigration(rootInput:string,stageInput:string):void {
  const root=resolve(rootInput),stage=resolve(stageInput),readyPath=join(stage,"ready.json")
  if(stage===root||stage.startsWith(root+"/"))throw new Error("Migration staging must be outside the live checkout")
  filesAt(stage)
  for(const name of [".spec-ledger",".spec-ledger-migration-pending","docs"])filesAt(join(root,name))
  if(!existsSync(readyPath))throw new Error("Migration must validate before publication")
  const ready=JSON.parse(readFileSync(readyPath,"utf8")) as {manifestSha256:string;files:Array<{path:string;sha256:string}>}
  if(hash(readFileSync(join(stage,"manifest.json")))!==ready.manifestSha256)throw new Error("Migration manifest changed after validation")
  const output=filesAt(join(stage,"output"));validateMigratedFiles(output)
  if(output.size!==ready.files.length||new Set(ready.files.map(f=>f.path)).size!==ready.files.length)throw new Error("Staged migration inventory changed")
  for(const f of ready.files)if(!output.get(f.path)||hash(output.get(f.path)!)!==f.sha256)throw new Error(`Staged migration changed: ${f.path}`)
  const journal=join(stage,"publication.json"),backup=join(stage,"live-backup")
  if(!existsSync(journal))writeFileSync(journal,JSON.stringify({root,startedAt:new Date().toISOString(),state:"publishing"})+"\n",{flag:"wx"})
  else if(JSON.parse(readFileSync(journal,"utf8")).root!==root)throw new Error("Publication journal targets another checkout")
  const state=JSON.parse(readFileSync(journal,"utf8")) as {state:string}
  if(state.state==="complete") {
    for(const f of ready.files)if(!existsSync(join(root,f.path))||hash(readFileSync(join(root,f.path)))!==f.sha256)throw new Error(`Live files changed after migration; refusing to overwrite: ${f.path}`)
    return
  }
  mkdirSync(backup,{recursive:true})
  const ledger=join(root,".spec-ledger"),old=join(backup,".spec-ledger")
  if(!existsSync(old))renameSync(ledger,old)
  if(!existsSync(ledger)){
    // Copy to a sibling staging directory first: rename stays on the checkout filesystem.
    const temporary=join(root,".spec-ledger-migration-pending")
    if(existsSync(temporary))rmSync(temporary,{recursive:true}) // Rebuild validated inventory after an interrupted copy.
    mkdirSync(temporary,{recursive:true})
    for(const [path,bytes]of output)if(path.startsWith(".spec-ledger/")){const target=join(temporary,path.slice(13));mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes)}
    renameSync(temporary,ledger)
  }
  for(const f of ready.files.filter(f=>f.path.startsWith(".spec-ledger/")))if(!existsSync(join(root,f.path))||hash(readFileSync(join(root,f.path)))!==f.sha256)throw new Error(`Live ledger differs from staged migration: ${f.path}`)
  const manifest=JSON.parse(readFileSync(join(stage,"manifest.json"),"utf8")) as {id:string;origins:Array<{paths:Record<string,string>}>}
  for(const origin of manifest.origins)for(const [before,after]of Object.entries(origin.paths))if(before.startsWith("docs/")&&before!==after&&existsSync(join(root,before))){const saved=join(backup,before);mkdirSync(dirname(saved),{recursive:true});if(!existsSync(saved))renameSync(join(root,before),saved)}
  for(const [path,bytes]of output)if(path.startsWith("docs/")){const target=join(root,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes)}
  const manifestTarget=join(ledger,"migrations",`${manifest.id}.json`);mkdirSync(dirname(manifestTarget),{recursive:true});writeFileSync(manifestTarget,readFileSync(join(stage,"manifest.json")))
  writeFileSync(journal,JSON.stringify({root,state:"complete",completedAt:new Date().toISOString()})+"\n")
}
