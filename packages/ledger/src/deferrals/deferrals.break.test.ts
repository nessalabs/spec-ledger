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
 for(const [id,feature] of [["W-001","multi-user"],["W-002","other"]]) {
  writeJson(join(root,`.spec-ledger/workstreams/${id}.json`),{schemaVersion:1,id,status:"shaped",title:id,featureIds:[feature],policy:{requireSpecBreak:false},trust:{},suggestedSlices:[{id:"SLC-01",title:"Build",kind:"vertical",acceptance:["Works"]}]})
  sealWorkstream(root,id,"fixture")
  recordAuthority(root,{id:`AUTH-${id}`,action:"grant",mode:"request",workstreamId:id,featureIds:[feature],source:{kind:"agent-reported",reference:"fixture explicit authority"}})
 }
 writeJson(join(root,".spec-ledger/turns/T-001.json"),{id:"T-001",status:"open",intent:{workstreamId:"W-001"}})
 writeJson(join(root,".spec-ledger/claims/SL-001.json"),{id:"SL-001",statement:"Tenant isolation",required:true})
 const decision:DeferredDecision={schemaVersion:1,id:"T-001/D-01",turnId:"T-001",decision:"Defer isolation",rationale:"Single user initially",deferral:{deferred:"Isolate tenants",originSpecRef:"W-001/spec",when:{kind:"feature-planned",featureId:"multi-user"},response,gate:"before-feature-complete",...(response==="implement"?{requirementRef:"SL-001"}:{})}}
 recordDeferredDecision(root,decision)
 return {root,decision}
}
function resolution(root:string,id="T-001/D-02",ws="W-001"):DeferredDecision {
 const p=permissionStatus(root,ws)
 return {schemaVersion:1,id,turnId:"T-001",decision:"Revisited scope",rationale:"Explicit consideration of prior commitment",deferralResolution:{decisionRef:"T-001/D-01",action:"revisited",workstreamId:ws,authorityRef:p.authorityId!,revisionDigest:p.revisionDigest}}
}
describe("deferred commitments adversarial",()=>{
 it("resolves implementation only with current behavior evidence and becomes due after code changes",()=>{
  const {root}=fixture()
  try {
   writeJson(join(root,".spec-ledger/bindings/b.json"),{id:"b",claimId:"SL-001",kind:"check",locator:{type:"results-row",resultsKey:"isolation"}})
   activateDeferralsForWork(root,"W-001")
   const ledger=loadLedger(root)
   writeJson(join(root,".spec-ledger/results/last.json"),{schemaVersion:1,producedAt:"2026-09-04T00:00:00Z",producer:{name:"fixture",version:"1"},rows:[{key:"isolation",outcome:"pass",sourceDigest:sourceFingerprint(root),checkDigest:checkFingerprint(ledger.claims[0],ledger.bindings[0])}]})
   assert.equal(evaluateDeferrals(root,"W-001")[0].state,"resolved")
   assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"W-001"))
   writeJson(join(root,"source.json"),{changed:true})
   assert.equal(evaluateDeferrals(root,"W-001")[0].state,"due")
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("activates idempotently and cannot erase the commitment by removing its feature or decision",()=>{
  const {root}=fixture()
  try {
   assert.equal(evaluateDeferrals(root,"W-001")[0].activated,false)
   activateDeferralsForWork(root,"W-001");activateDeferralsForWork(root,"W-001")
   assert.equal(readdirSync(join(root,".spec-ledger/deferral-activations")).length,1)
   const ws=loadWorkstream(root,"W-001");ws.featureIds=[];writeJson(join(root,".spec-ledger/workstreams/W-001.json"),ws)
   assert.equal(evaluateDeferrals(root,"W-001")[0].affected,true)
   assert.throws(()=>assertDeferralsSatisfied(root,"W-001"),/prevent completion/)
   rmSync(join(root,".spec-ledger/decisions/T-001/D-01.json"))
   assert.equal(evaluateDeferrals(root,"W-001")[0].state,"unknown")
   assert.throws(()=>assertDeferralsSatisfied(root,"W-001"),/prevent completion/)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("retrieves old commitments without recent turns and keeps backlog candidates optional",()=>{
  const {root}=fixture()
  try {
   rmSync(join(root,".spec-ledger/turns/T-001.json"))
   for(let i=100;i<130;i++)writeJson(join(root,`.spec-ledger/turns/T-${i}.json`),{id:`T-${i}`,status:"closed",intent:{featureIds:[]}})
   assert.equal(listDeferredDecisions(root)[0].id,"T-001/D-01")
   assert.equal(backlog(root,"W-001").deferrals.length,1)
   assert.equal(backlog(root).externalDiscovery.status,"not-configured")
   assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"W-002"))
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("refuses hard-requirement dismissal and path-only green evidence",()=>{
  const {root}=fixture()
  try {
   writeJson(join(root,".spec-ledger/bindings/b.json"),{id:"b",claimId:"SL-001",kind:"check",locator:{type:"path",path:".spec-ledger/ledger.json"}})
   activateDeferralsForWork(root,"W-001")
   assert.equal(evaluateDeferrals(root,"W-001")[0].state,"due")
   assert.throws(()=>recordDeferralResolution(root,resolution(root)),/hard requirements/)
   assert.throws(()=>assertDeferralsSatisfied(root,"W-001"),/prevent completion/)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("requires applicable current authority for revisit and reopens after revocation",()=>{
  const {root}=fixture("revisit")
  try {
   activateDeferralsForWork(root,"W-001")
   assert.throws(()=>recordDeferralResolution(root,resolution(root,"T-001/D-02","W-002")),/applicable/)
   const answer=resolution(root)
   recordDeferralResolution(root,answer)
   assert.equal(evaluateDeferrals(root,"W-001")[0].state,"resolved")
   recordAuthority(root,{action:"revoke",targetId:answer.deferralResolution!.authorityRef,source:{kind:"agent-reported",reference:"fixture revokes authority"}})
   assert.equal(evaluateDeferrals(root,"W-001")[0].state,"due")
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("projects missing references and malformed commitments as unknown",()=>{
  const {root,decision}=fixture()
  try {
   writeJson(join(root,".spec-ledger/decisions/T-001/D-01.json"),{...decision,deferral:{...decision.deferral,when:{kind:"feature-planned",featureId:"missing"}}})
   assert.equal(evaluateDeferrals(root,"W-001")[0].state,"unknown")
   writeJson(join(root,".spec-ledger/decisions/T-001/D-01.json"),{...decision,deferral:{...decision.deferral,deferred:42}})
   assert.equal(evaluateDeferrals(root,"W-001")[0].state,"unknown")
  }finally{rmSync(root,{recursive:true,force:true})}
 })
})
