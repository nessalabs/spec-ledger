import {describe,it} from "node:test"
import assert from "node:assert/strict"
import {mkdtempSync,rmSync,writeFileSync,readFileSync,readdirSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {createServer} from "node:http"
import type {AddressInfo} from "node:net"
import {initLedger} from "../cli/init.js"
import {loadLedger,writeJson} from "../fs/load.js"
import {sealWorkstream} from "../workstream/load.js"
import {recordAuthority,permissionStatus} from "../permission/authority.js"
import {sourceFingerprint,checkFingerprint} from "../evidence/fingerprint.js"
import {recordProgress,getSession,completeWorkstream} from "./project.js"
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
