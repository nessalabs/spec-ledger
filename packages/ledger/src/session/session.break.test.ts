import {describe,it} from "node:test"
import {randomUUID} from "node:crypto"
import assert from "node:assert/strict"
import {mkdtempSync,rmSync,writeFileSync,readFileSync,readdirSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {createServer} from "node:http"
import type {AddressInfo} from "node:net"
import {initLedger} from "../cli/init.js"
import {loadLedger,writeJson} from "../fs/load.js"
import {loadWorkstream,sealWorkstream} from "../workstream/load.js"
import {recordAuthority,permissionStatus} from "../permission/authority.js"
import {sourceFingerprint,checkFingerprint} from "../evidence/fingerprint.js"
import {recordProgress,getSession,completeWorkstream} from "./project.js"
import {recordDeferredDecision} from "../deferrals/index.js"
import {preserveWorkflow} from "../workflows/index.js"
function fixture(){
 const root=mkdtempSync(join(tmpdir(),"sl-session-break-"));initLedger(root,"session breaker")
 writeFileSync(join(root,"source.ts"),"source")
 writeJson(join(root,".spec-ledger/claims/02f2ae36-9568-53f9-bc0c-a25f0a7e3af4.json"),{id:"02f2ae36-9568-53f9-bc0c-a25f0a7e3af4",statement:"Behavior",required:true})
 writeJson(join(root,".spec-ledger/bindings/a56b72e7-48a0-5cd6-b5c2-20eb12257138.json"),{id:"a56b72e7-48a0-5cd6-b5c2-20eb12257138",claimId:"02f2ae36-9568-53f9-bc0c-a25f0a7e3af4",kind:"check",locator:{type:"results-row",resultsKey:"r"}})
 writeJson(join(root,".spec-ledger/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad.json"),{schemaVersion:1,id:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",status:"shaped",title:"Work",featureIds:["alpha"],acceptanceCriteria:["Behavior works"],acceptanceClaimIds:{"AC-1":["02f2ae36-9568-53f9-bc0c-a25f0a7e3af4"]},policy:{requireSpecBreak:false,requireCodeBreak:false},trust:{},suggestedSlices:[{id:"886b091f-57f9-5f69-9e74-f0b50275d693",title:"Build",kind:"vertical",acceptance:["Works"]}]})
 sealWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad","fixture")
 recordAuthority(root,{action:"grant",mode:"request",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",featureIds:["alpha"],source:{kind:"agent-reported",reference:"fixture"}})
 writeJson(join(root,".spec-ledger/turns/1c5a8e44-dd09-543a-97d5-bfe173becbaa.json"),{schemaVersion:1,id:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",status:"open",intent:{workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",featureIds:["alpha"]}})
 return root
}
function evidence(root:string){
 const ledger=loadLedger(root)
 writeJson(join(root,".spec-ledger/results/last.json"),{schemaVersion:1,producedAt:"2026-09-04T00:00:00Z",producer:{name:"fixture",version:"1"},rows:[{key:"r",outcome:"pass",sourceDigest:sourceFingerprint(root),checkDigest:checkFingerprint(ledger.claims[0],ledger.bindings[0])}]})
}
describe("session projection adversarial",()=>{
 it("activity preserves the originating turn and recorded dates without inventing missing historical dates",()=>{
  const root=fixture(),turnId="1c5a8e44-dd09-543a-97d5-bfe173becbaa"
  try {
   const cases=[{sequence:1,decision:"Explicit timestamp",recordedAt:"2026-09-06T12:00:00Z",basis:{at:"2026-09-05T12:00:00Z"}},{sequence:2,decision:"Historical basis timestamp",basis:{at:"2026-09-04T12:00:00Z"}},{sequence:3,decision:"No timestamp",basis:{}}].map(value=>({...value,id:randomUUID(),turnId,rationale:"Recorded context"}))
   for(const value of cases)writeJson(join(root,".spec-ledger/decisions",turnId,`${value.id}.json`),value)
   const before=cases.map(value=>readFileSync(join(root,".spec-ledger/decisions",turnId,`${value.id}.json`),"utf8"))
   const activity=getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!.activity
   assert.deepEqual(activity.map(item=>item.id),cases.map(value=>value.id).reverse())
   assert.ok(activity.every(item=>item.turnId===turnId&&item.id!==turnId))
   assert.deepEqual(activity.map(item=>item.recordedAt),[null,"2026-09-04T12:00:00Z","2026-09-06T12:00:00Z"])
   assert.deepEqual(cases.map(value=>readFileSync(join(root,".spec-ledger/decisions",turnId,`${value.id}.json`),"utf8")),before)
  } finally {rmSync(root,{recursive:true,force:true})}
 })
 it("serves identical session state through both clients without writes",async()=>{
  const root=fixture()
  const {createSpecLedgerClient}=await import(new URL("../../../client/dist/index.js",import.meta.url).href)
  const {buildRoutes}=await import(new URL("../../../server/dist/routes.js",import.meta.url).href)
  const routes=buildRoutes(root)
  const server=createServer(async(req,res)=>{
   const url=new URL(req.url!,"http://localhost")
   const route=routes.find((r:{pattern:RegExp})=>r.pattern.test(url.pathname))
   if(!route){res.writeHead(404).end();return}
   await route.handler(req,res,{})
  })
  const files=()=>Object.fromEntries(readdirSync(root,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>[join(e.parentPath,e.name),readFileSync(join(e.parentPath,e.name)).toString("base64")]))
  try{
   await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve))
   const before=files()
   const local=await createSpecLedgerClient({kind:"inProcess",rootDir:root}).getSession("2b74bc14-227a-5c05-b2ed-1c32d9703cad")
   const remote=await createSpecLedgerClient({kind:"http",baseUrl:`http://127.0.0.1:${(server.address() as AddressInfo).port}`}).getSession("2b74bc14-227a-5c05-b2ed-1c32d9703cad")
   // JSON transport omits undefined optional fields; compare the shared wire contract.
   assert.deepEqual({...remote,observedAt:null},JSON.parse(JSON.stringify({...local,observedAt:null})))
   assert.deepEqual(files(),before)
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(root,{recursive:true,force:true})}
 })
 it("rechecks revoked permission before completing otherwise finished work",()=>{
  const root=fixture()
  try{
   evidence(root)
   recordProgress(root,{turnId:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",summary:"Ready",criterionIds:["AC-1"],implemented:true})
   writeJson(join(root,".spec-ledger/turns/1c5a8e44-dd09-543a-97d5-bfe173becbaa.json"),{id:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",status:"closed",intent:{workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",featureIds:["alpha"]}})
   assert.equal(getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!.completion.eligible,true)
   recordAuthority(root,{action:"revoke",targetId:permissionStatus(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").authorityId,source:{kind:"agent-reported",reference:"fixture revoked"}})
   assert.equal(getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!.completion.eligible,false)
   assert.throws(()=>completeWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad"),/permission|executable/)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("permits completion after implementation, current evidence, and turn closure all satisfy policy",()=>{
  const root=fixture()
  try{
   evidence(root)
   recordProgress(root,{turnId:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",summary:"Behavior implemented",criterionIds:["AC-1"],implemented:true})
   assert.equal(getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!.completion.eligible,false,"open turn must block completion")
   writeJson(join(root,".spec-ledger/turns/1c5a8e44-dd09-543a-97d5-bfe173becbaa.json"),{id:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",status:"closed",intent:{workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",featureIds:["alpha"]}})
   const session=getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!
   assert.equal(session.completion.eligible,true,session.completion.reasons.join("; "))
   assert.equal(completeWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").status,"done")
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("does not turn agent progress into proof and stales progress/preview after source changes",()=>{
  const root=fixture()
  try{
   recordProgress(root,{turnId:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",summary:"Agent says built",criterionIds:["AC-1"],implemented:true,preview:{url:"http://127.0.0.1:3737/",label:"Preview"}})
   let session=getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!
   assert.equal(session.criteria[0].implemented,true);assert.equal(session.criteria[0].evidence,"missing")
   assert.equal(session.preview!.availability,"unconfirmed")
   assert.equal(session.completion.eligible,false)
   assert.equal(session.handoff.provenance,"portable-cli")
   assert.match(session.handoff.approve,new RegExp(session.revisionDigest))
   writeFileSync(join(root,"source.ts"),"changed")
   session=getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!
   assert.equal(session.criteria[0].implemented,false);assert.equal(session.preview,null)
   assert.throws(()=>recordProgress(root,{turnId:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",summary:"unsafe preview",criterionIds:["AC-1"],implemented:true,preview:{url:"javascript:alert(1)",label:"bad"}}),/HTTP/)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
})


describe("overall completion projection adversarial",()=>{
 const wsId="2b74bc14-227a-5c05-b2ed-1c32d9703cad",turnId="1c5a8e44-dd09-543a-97d5-bfe173becbaa"
 const session=(root:string)=>getSession(root,wsId).session!
 const close=(root:string)=>writeJson(join(root,`.spec-ledger/turns/${turnId}.json`),{id:turnId,status:"closed",intent:{workstreamId:wsId,featureIds:["alpha"]}})
 it("passing evidence does not finish implementation or open work and task totals survive progress",()=>{
  const root=fixture()
  try{
   evidence(root)
   const initial=session(root),tasks=initial.completion.checklist
   assert.equal(initial.criteria[0].evidence,"pass")
   assert.equal(tasks.find(x=>x.id==="criteria")!.done,0)
   assert.equal(tasks.find(x=>x.id==="turn")!.state,"todo")
   assert.equal(initial.completion.eligible,false)
   recordProgress(root,{turnId,summary:"Implemented",criterionIds:["AC-1"],implemented:true})
   const built=session(root)
   assert.equal(built.completion.checklist.find(x=>x.id==="criteria")!.done,1)
   assert.equal(built.completion.eligible,false)
   close(root)
   const ready=session(root)
   assert.equal(ready.completion.eligible,true)
   assert.ok(ready.completion.checklist.every(x=>x.state==="done"))
   assert.deepEqual(ready.completion.checklist.map(x=>[x.id,x.total]),tasks.map(x=>[x.id,x.total]))
   recordAuthority(root,{action:"revoke",targetId:permissionStatus(root,wsId).authorityId,source:{kind:"agent-reported",reference:"revoked"}})
   const denied=session(root)
   assert.equal(denied.completion.checklist.find(x=>x.id==="permission")!.state,"todo")
   assert.equal(denied.completion.eligible,false)
   assert.deepEqual(denied.completion.checklist.map(x=>[x.id,x.total]),tasks.map(x=>[x.id,x.total]))
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("required reviews screenshots commitments and selected workflow are counted once despite multiple diagnostics",()=>{
  const root=fixture()
  try{
   const ws=loadWorkstream(root,wsId),slice=ws.suggestedSlices![0].id
   writeJson(join(root,`.spec-ledger/workstreams/${wsId}.json`),{...ws,policy:{requireSpecBreak:true,requireCodeBreak:true},trust:{visualEvidence:{[slice]:["Desktop","Mobile"]}}})
   sealWorkstream(root,wsId,"updated fixture")
   recordAuthority(root,{action:"grant",mode:"request",workstreamId:wsId,featureIds:["alpha"],source:{kind:"agent-reported",reference:"fixture"}})
   recordDeferredDecision(root,{schemaVersion:1,id:randomUUID(),turnId,decision:"Deferred decision",rationale:"Needs a later decision",deferral:{deferred:"Revisit",originSpecRef:wsId+"/spec",when:{kind:"feature-planned",featureId:"alpha"},response:"revisit",gate:"before-feature-complete"}})
   preserveWorkflow(root,wsId,undefined,"Selected default")
   evidence(root)
   recordProgress(root,{turnId,summary:"Implemented",criterionIds:["AC-1"],implemented:true})
   close(root)
   const projected=session(root),tasks=projected.completion.checklist
   assert.equal(projected.criteria[0].evidence,"pass")
   assert.equal(projected.criteria[0].implemented,true)
   assert.equal(projected.completion.eligible,false)
   assert.equal(new Set(tasks.map(x=>x.id)).size,tasks.length)
   for(const id of ["spec-review","code-review","screenshots","deferrals","workflow"]){
    assert.equal(tasks.filter(x=>x.id===id).length,1,id)
    assert.notEqual(tasks.find(x=>x.id===id)!.state,"done",id)
   }
   assert.equal(tasks.find(x=>x.id==="screenshots")!.total,2)
   assert.equal(tasks.find(x=>x.id==="deferrals")!.total,1)
   assert.equal(tasks.find(x=>x.id==="code-review")!.total,1)
   const outputs=projected.workflow.stages.filter(x=>x.status!=="not-applicable").flatMap(x=>x.requiredOutputs)
   assert.equal(tasks.find(x=>x.id==="workflow")!.total,outputs.length)
   assert.ok(projected.completion.reasons.length>0)
   assert.ok(!tasks.some(x=>x.id==="attention"),"diagnostic reasons are not additional work")
  }finally{rmSync(root,{recursive:true,force:true})}
 })
})
