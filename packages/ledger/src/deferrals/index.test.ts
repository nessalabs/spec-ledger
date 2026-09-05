import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { initLedger } from "../cli/init.js"
import { loadLedger, writeJson } from "../fs/load.js"
import { sealWorkstream, loadWorkstream, writeWorkstream } from "../workstream/load.js"
import { recordAuthority, permissionStatus } from "../permission/authority.js"
import { sourceFingerprint, checkFingerprint } from "../evidence/fingerprint.js"
import { activateDeferralsForWork, assertDeferralsSatisfied, backlog, evaluateDeferrals, recordDeferredDecision, recordDeferralResolution, type DeferredDecision } from "./index.js"

function fixture() {
  const root=mkdtempSync(join(tmpdir(),"sl-deferrals-"))
  initLedger(root,"deferrals")
  writeFileSync(join(root,"product.ts"),"tenant scope enabled\n")
  writeJson(join(root,".spec-ledger/graph/codebase-graph.json"),{schemaVersion:1,features:[{id:"multi-user",title:"Multi user"},{id:"billing",title:"Billing"}],nodes:[],edges:[]})
  for (const [id,feature] of [["W-001","multi-user"],["W-002","billing"]]) {
    writeJson(join(root,`.spec-ledger/workstreams/${id}.json`),{schemaVersion:1,id,status:"shaped",createdAt:"2026-01-01",title:id,problem:"test",objective:"test",featureIds:[feature],policy:{requireSpecBreak:false},suggestedSlices:[{id:"SLC-01",title:"work",kind:"vertical",acceptance:["works"]}]})
    recordAuthority(root,{id:`AUTH-${id}`,action:"grant",mode:"request",workstreamId:id,featureIds:[feature],source:{kind:"agent-reported",reference:"fixture authorization"}})
  }
  writeJson(join(root,".spec-ledger/turns/T-001.json"),{schemaVersion:1,id:"T-001",status:"open"})
  writeJson(join(root,".spec-ledger/claims/ISOLATION.json"),{id:"ISOLATION",kind:"spec",statement:"Tenants cannot access each other's data",required:true})
  return root
}
function deferred(response:"implement"|"revisit"="implement"):DeferredDecision {
  return {schemaVersion:1,id:"T-001/D-01",turnId:"T-001",decision:"Defer tenant isolation",rationale:"Single user release",deferral:{deferred:"Isolate tenants",originSpecRef:"W-001",when:{kind:"feature-planned",featureId:"multi-user"},response,gate:"before-feature-complete",...(response==="implement" ? {requirementRef:"ISOLATION"} : {})}}
}
function activate(root:string) { sealWorkstream(root,"W-001","fixture");return activateDeferralsForWork(root,"W-001") }
function files(root:string):string { return JSON.stringify(readdirSync(root,{recursive:true}).sort()) }

test("old deferrals appear in planning without activating or making backlog candidates mandatory",()=> {
  const root=fixture()
  try {
    recordDeferredDecision(root,deferred())
    for(let n=2;n<90;n++) writeJson(join(root,`.spec-ledger/turns/T-${String(n).padStart(3,"0")}.json`),{schemaVersion:1,id:`T-${String(n).padStart(3,"0")}`,status:"closed"})
    const before=files(root)
    const result=backlog(root,"W-001")
    assert.equal(result.deferrals[0].decisionRef,"T-001/D-01")
    assert.equal(result.deferrals[0].state,"not-due")
    assert.equal(result.externalDiscovery.status,"not-configured")
    assert.equal(result.candidates.every(w=>w.optional),true)
    assert.equal(files(root),before)
    assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"W-002"))
  } finally {rmSync(root,{recursive:true,force:true})}
})

test("activation survives retries, feature removal, and source decision deletion",()=> {
  const root=fixture()
  try {
    recordDeferredDecision(root,deferred())
    assert.equal(activate(root)[0].state,"due")
    const before=files(root)
    activateDeferralsForWork(root,"W-001")
    assert.equal(files(root),before)
    assert.equal(readdirSync(join(root,".spec-ledger/deferral-activations")).length,1)
    const ws=loadWorkstream(root,"W-001");ws.featureIds=[];writeWorkstream(root,ws)
    assert.equal(evaluateDeferrals(root,"W-001")[0].affected,true)
    assert.throws(()=>assertDeferralsSatisfied(root,"W-001"),/prevent completion/)
    rmSync(join(root,".spec-ledger/decisions/T-001/D-01.json"))
    assert.equal(evaluateDeferrals(root,"W-001")[0].state,"unknown")
    assert.throws(()=>assertDeferralsSatisfied(root,"W-001"),/changed or removed/)
    assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"W-002"))
  } finally {rmSync(root,{recursive:true,force:true})}
})

test("missing trigger, origin, and claim references remain unknown",()=> {
  for (const missing of ["feature","origin","claim"]) {
    const root=fixture()
    try {
      const d=deferred()
      if(missing==="feature") d.deferral!.when.featureId="missing"
      if(missing==="origin") d.deferral!.originSpecRef="W-999"
      if(missing==="claim") d.deferral!.requirementRef="missing"
      recordDeferredDecision(root,d)
      assert.equal(evaluateDeferrals(root,"W-001")[0].state,"unknown")
    } finally {rmSync(root,{recursive:true,force:true})}
  }
})

test("hard implementation gates require current behavior evidence and reject re-deferral",()=> {
  const root=fixture()
  try {
    recordDeferredDecision(root,deferred());activate(root)
    const path=join(root,".spec-ledger/bindings/isolation.json")
    writeJson(path,{id:"check-isolation",claimId:"ISOLATION",kind:"check",locator:{type:"path",path:"product.ts"}})
    assert.throws(()=>assertDeferralsSatisfied(root,"W-001"),/paths and attestation/)
    const permission=permissionStatus(root,"W-001")
    assert.throws(()=>recordDeferralResolution(root,{...deferred(),id:"T-001/D-02",deferralResolution:{decisionRef:"T-001/D-01",action:"re-deferred",workstreamId:"W-001",authorityRef:permission.authorityId!,revisionDigest:permission.revisionDigest}}),/hard requirements/)
    writeJson(path,{id:"check-isolation",claimId:"ISOLATION",kind:"test",locator:{type:"results-row",resultsKey:"isolates"}})
    const ledger=loadLedger(root)
    writeJson(join(root,".spec-ledger/results/last.json"),{schemaVersion:1,producer:{name:"test",version:"1"},producedAt:new Date().toISOString(),rows:[{key:"isolates",outcome:"pass",sourceDigest:sourceFingerprint(root),checkDigest:checkFingerprint(ledger.claims.find(c=>c.id==="ISOLATION")!,ledger.bindings.find(b=>b.id==="check-isolation")!)}]})
    assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"W-001"))
    writeFileSync(join(root,"product.ts"),"isolation broken\n")
    assert.throws(()=>assertDeferralsSatisfied(root,"W-001"),/current passing evidence/)
  } finally {rmSync(root,{recursive:true,force:true})}
})

test("revisit resolution records real current authority, rejects invented authority and revoked approval",()=> {
  const root=fixture()
  try {
    recordDeferredDecision(root,deferred("revisit"));activate(root)
    const permission=permissionStatus(root,"W-001")
    const d:DeferredDecision={schemaVersion:1,id:"T-001/D-02",turnId:"T-001",decision:"Retain single-user release",rationale:"Reviewed planned access and confirmed no shared tenancy",deferralResolution:{decisionRef:"T-001/D-01",action:"revisited",authorityRef:"AUTH-fake",workstreamId:"W-001",revisionDigest:permission.revisionDigest}}
    assert.throws(()=>recordDeferralResolution(root,d),/current explicit authority/)
    d.deferralResolution!.authorityRef=permission.authorityId!
    recordDeferralResolution(root,d)
    assert.deepEqual(recordDeferralResolution(root,d),d)
    assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"W-001"))
    recordAuthority(root,{action:"revoke",targetId:permission.authorityId,source:{kind:"agent-reported",reference:"fixture revoke"}})
    assert.throws(()=>assertDeferralsSatisfied(root,"W-001"),/authorized recorded revisit/)
  } finally {rmSync(root,{recursive:true,force:true})}
})

test("re-deferring a revisit preserves its history and gates the replacement when its feature arrives",()=> {
  const root=fixture()
  try {
    recordDeferredDecision(root,deferred("revisit"));activate(root)
    const permission=permissionStatus(root,"W-001")
    const replacement:DeferredDecision={...deferred("revisit"),id:"T-001/D-02",decision:"Revisit billing isolation with billing",rationale:"Current feature has no billing data; revisit when billing is planned",deferralResolution:{decisionRef:"T-001/D-01",action:"re-deferred",authorityRef:permission.authorityId!,workstreamId:"W-001",revisionDigest:permission.revisionDigest}}
    replacement.deferral!.when.featureId="billing"
    recordDeferralResolution(root,replacement)
    assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"W-001"))
    assert.equal(evaluateDeferrals(root,"W-001").find(d=>d.decisionRef==="T-001/D-01")!.state,"resolved")
    sealWorkstream(root,"W-002","fixture")
    activateDeferralsForWork(root,"W-002")
    assert.throws(()=>assertDeferralsSatisfied(root,"W-002"),/T-001\/D-02/)
    assert.throws(()=>recordDeferredDecision(root,{...deferred("revisit"),rationale:"Silently rewrite why we postponed"}),/different content/)
  } finally {rmSync(root,{recursive:true,force:true})}
})

test("malformed text, schema, activation, and resolution records never produce satisfaction",()=> {
  const root=fixture()
  try {
    const original=deferred("revisit")
    recordDeferredDecision(root,original)
    const decisionPath=join(root,".spec-ledger/decisions/T-001/D-01.json")
    for (const field of ["deferred","originSpecRef","requirementRef"]) {
      writeJson(decisionPath,{...original,deferral:{...original.deferral,[field]:42}})
      assert.equal(evaluateDeferrals(root,"W-001")[0].state,"unknown")
    }
    writeJson(decisionPath,{...original,schemaVersion:2})
    assert.equal(evaluateDeferrals(root,"W-001")[0].state,"unknown")
    writeJson(decisionPath,original)
    activate(root)
    const permission=permissionStatus(root,"W-001")
    writeJson(join(root,".spec-ledger/decisions/T-001/D-02.json"),{schemaVersion:1,id:"T-001/D-02",turnId:"T-001",decision:"Reviewed",rationale:42,deferralResolution:{decisionRef:original.id,action:"revisited",authorityRef:permission.authorityId,workstreamId:"W-001",revisionDigest:permission.revisionDigest}})
    assert.equal(evaluateDeferrals(root,"W-001")[0].state,"due")
    const receipt=join(root,".spec-ledger/deferral-activations",readdirSync(join(root,".spec-ledger/deferral-activations"))[0])
    writeJson(receipt,{schemaVersion:2,decision:original,workstreamId:"W-001",activatedAt:"2026-01-01"})
    assert.equal(evaluateDeferrals(root,"W-001")[0].state,"unknown")
    writeJson(receipt,null)
    assert.equal(evaluateDeferrals(root,"W-001").some(d=>d.state==="unknown" && d.affected),true)
    assert.throws(()=>assertDeferralsSatisfied(root,"W-001"),/prevent completion/)
  } finally {rmSync(root,{recursive:true,force:true})}
})
