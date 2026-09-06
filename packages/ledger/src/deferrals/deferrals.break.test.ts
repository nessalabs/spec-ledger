import { randomUUID } from "node:crypto"
import { describe,it } from "node:test"
import assert from "node:assert/strict"
import {mkdtempSync,readdirSync,rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {sourceFingerprint,checkFingerprint} from "../evidence/fingerprint.js"
import {initLedger} from "../cli/init.js"
import {loadLedger,writeJson} from "../fs/load.js"
import {loadWorkstream,sealWorkstream} from "../workstream/load.js"
import {recordAuthority,permissionStatus} from "../permission/authority.js"
import {recordDeferredDecision,evaluateDeferrals,activateDeferralsForWork,assertDeferralsSatisfied,recordDeferralResolution,listDeferredDecisions,backlog,type DeferredDecision} from "./index.js"

function fixture(response:"implement"|"revisit"="implement") {
 const root=mkdtempSync(join(tmpdir(),"sl-deferral-break-"));initLedger(root,"deferral breaker")
 const ledger=loadLedger(root)
 writeJson(join(root,".spec-ledger/graph/codebase-graph.json"),{...ledger.graph,features:[{id:"multi-user",name:"Multi-user"},{id:"other",name:"Other"}]})
 for(const [id,feature] of [["2b74bc14-227a-5c05-b2ed-1c32d9703cad","multi-user"],["d30877ac-696d-5e71-b593-783728a4c76d","other"]]) {
  writeJson(join(root,`.spec-ledger/workstreams/${id}.json`),{schemaVersion:1,id,status:"shaped",title:id,featureIds:[feature],policy:{requireSpecBreak:false},trust:{},suggestedSlices:[{id:"886b091f-57f9-5f69-9e74-f0b50275d693",title:"Build",kind:"vertical",acceptance:["Works"]}]})
  sealWorkstream(root,id,"fixture")
  recordAuthority(root,{action:"grant",mode:"request",workstreamId:id,featureIds:[feature],source:{kind:"agent-reported",reference:"fixture explicit authority"}})
 }
 writeJson(join(root,".spec-ledger/turns/1c5a8e44-dd09-543a-97d5-bfe173becbaa.json"),{id:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",status:"open",intent:{workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad"}})
 writeJson(join(root,".spec-ledger/claims/02f2ae36-9568-53f9-bc0c-a25f0a7e3af4.json"),{id:"02f2ae36-9568-53f9-bc0c-a25f0a7e3af4",statement:"Tenant isolation",required:true})
 const decision:DeferredDecision={schemaVersion:1,id:"1bfea0eb-01b6-5562-8971-ba7af7e2275f",turnId:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",decision:"Defer isolation",rationale:"Single user initially",deferral:{deferred:"Isolate tenants",originSpecRef:"2b74bc14-227a-5c05-b2ed-1c32d9703cad/spec",when:{kind:"feature-planned",featureId:"multi-user"},response,gate:"before-feature-complete",...(response==="implement"?{requirementRef:"02f2ae36-9568-53f9-bc0c-a25f0a7e3af4"}:{})}}
 recordDeferredDecision(root,decision)
 return {root,decision}
}
function resolution(root:string,id="5d1a553f-77a6-5ca6-89c8-cdeb8db15121",ws="2b74bc14-227a-5c05-b2ed-1c32d9703cad"):DeferredDecision {
 const p=permissionStatus(root,ws)
 return {schemaVersion:1,id,turnId:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",decision:"Revisited scope",rationale:"Explicit consideration of prior commitment",deferralResolution:{decisionRef:"1bfea0eb-01b6-5562-8971-ba7af7e2275f",action:"revisited",workstreamId:ws,authorityRef:p.authorityId!,revisionDigest:p.revisionDigest}}
}
describe("deferred commitments adversarial",()=>{
 it("resolves implementation only with current behavior evidence and becomes due after code changes",()=>{
  const {root}=fixture()
  try {
   writeJson(join(root,".spec-ledger/bindings/a56b72e7-48a0-5cd6-b5c2-20eb12257138.json"),{id:"a56b72e7-48a0-5cd6-b5c2-20eb12257138",claimId:"02f2ae36-9568-53f9-bc0c-a25f0a7e3af4",kind:"check",locator:{type:"results-row",resultsKey:"isolation"}})
   activateDeferralsForWork(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")
   const ledger=loadLedger(root)
   writeJson(join(root,".spec-ledger/results/last.json"),{schemaVersion:1,producedAt:"2026-09-04T00:00:00Z",producer:{name:"fixture",version:"1"},rows:[{key:"isolation",outcome:"pass",sourceDigest:sourceFingerprint(root),checkDigest:checkFingerprint(ledger.claims[0],ledger.bindings[0])}]})
   assert.equal(evaluateDeferrals(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")[0].state,"resolved")
   assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad"))
   writeJson(join(root,"source.json"),{changed:true})
   assert.equal(evaluateDeferrals(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")[0].state,"due")
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("activates idempotently and cannot erase the commitment by removing its feature or decision",()=>{
  const {root}=fixture()
  try {
   assert.equal(evaluateDeferrals(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")[0].activated,false)
   activateDeferralsForWork(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad");activateDeferralsForWork(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")
   assert.equal(readdirSync(join(root,".spec-ledger/deferral-activations")).length,1)
   const ws=loadWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad");ws.featureIds=[];writeJson(join(root,".spec-ledger/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad.json"),ws)
   assert.equal(evaluateDeferrals(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")[0].affected,true)
   assert.throws(()=>assertDeferralsSatisfied(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad"),/prevent completion/)
   rmSync(join(root,".spec-ledger/decisions/1c5a8e44-dd09-543a-97d5-bfe173becbaa/1bfea0eb-01b6-5562-8971-ba7af7e2275f.json"))
   assert.equal(evaluateDeferrals(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")[0].state,"unknown")
   assert.throws(()=>assertDeferralsSatisfied(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad"),/prevent completion/)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("retrieves old commitments without recent turns and keeps backlog candidates optional",()=>{
  const {root}=fixture()
  try {
   rmSync(join(root,".spec-ledger/turns/1c5a8e44-dd09-543a-97d5-bfe173becbaa.json"))
   for(let i=100;i<130;i++){const id=randomUUID();writeJson(join(root,`.spec-ledger/turns/${id}.json`),{id,status:"closed",openedAt:new Date(Date.UTC(2026,0,1,0,i)).toISOString(),intent:{featureIds:[]}})}
   assert.equal(listDeferredDecisions(root)[0].id,"1bfea0eb-01b6-5562-8971-ba7af7e2275f")
   assert.equal(backlog(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").deferrals.length,1)
   assert.equal(backlog(root).externalDiscovery.status,"not-configured")
   assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"d30877ac-696d-5e71-b593-783728a4c76d"))
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("refuses hard-requirement dismissal and path-only green evidence",()=>{
  const {root}=fixture()
  try {
   writeJson(join(root,".spec-ledger/bindings/a56b72e7-48a0-5cd6-b5c2-20eb12257138.json"),{id:"a56b72e7-48a0-5cd6-b5c2-20eb12257138",claimId:"02f2ae36-9568-53f9-bc0c-a25f0a7e3af4",kind:"check",locator:{type:"path",path:".spec-ledger/ledger.json"}})
   activateDeferralsForWork(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")
   assert.equal(evaluateDeferrals(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")[0].state,"due")
   assert.throws(()=>recordDeferralResolution(root,resolution(root)),/hard requirements/)
   assert.throws(()=>assertDeferralsSatisfied(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad"),/prevent completion/)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("requires applicable current authority for revisit and reopens after revocation",()=>{
  const {root}=fixture("revisit")
  try {
   activateDeferralsForWork(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")
   assert.throws(()=>recordDeferralResolution(root,resolution(root,"5d1a553f-77a6-5ca6-89c8-cdeb8db15121","d30877ac-696d-5e71-b593-783728a4c76d")),/applicable/)
   const answer=resolution(root)
   recordDeferralResolution(root,answer)
   assert.equal(evaluateDeferrals(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")[0].state,"resolved")
   recordAuthority(root,{action:"revoke",targetId:answer.deferralResolution!.authorityRef,source:{kind:"agent-reported",reference:"fixture revokes authority"}})
   assert.equal(evaluateDeferrals(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")[0].state,"due")
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("projects missing references and malformed commitments as unknown",()=>{
  const {root,decision}=fixture()
  try {
   writeJson(join(root,".spec-ledger/decisions/1c5a8e44-dd09-543a-97d5-bfe173becbaa/1bfea0eb-01b6-5562-8971-ba7af7e2275f.json"),{...decision,deferral:{...decision.deferral,when:{kind:"feature-planned",featureId:"missing"}}})
   assert.equal(evaluateDeferrals(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")[0].state,"unknown")
   writeJson(join(root,".spec-ledger/decisions/1c5a8e44-dd09-543a-97d5-bfe173becbaa/1bfea0eb-01b6-5562-8971-ba7af7e2275f.json"),{...decision,deferral:{...decision.deferral,deferred:42}})
   assert.equal(evaluateDeferrals(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")[0].state,"unknown")
  }finally{rmSync(root,{recursive:true,force:true})}
 })
})
