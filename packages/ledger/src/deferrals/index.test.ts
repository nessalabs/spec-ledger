import { randomUUID } from "node:crypto"
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
  for (const [id,feature] of [["6fbba68d-7164-55a6-80f9-18dea06c91ce","multi-user"],["fbc810b4-5087-528f-b1c3-ce1c02b88970","billing"]]) {
    writeJson(join(root,`.spec-ledger/workstreams/${id}.json`),{schemaVersion:1,id,status:"shaped",createdAt:"2026-01-01",title:id,problem:"test",objective:"test",featureIds:[feature],policy:{requireSpecBreak:false},suggestedSlices:[{id:"0d0038da-bb13-561e-ac49-570f6ed0f334",title:"work",kind:"vertical",acceptance:["works"]}]})
    recordAuthority(root,{action:"grant",mode:"request",workstreamId:id,featureIds:[feature],source:{kind:"agent-reported",reference:"fixture authorization"}})
  }
  writeJson(join(root,".spec-ledger/turns/bcbf5513-797b-5a84-b5cf-eb04b5444708.json"),{schemaVersion:1,id:"bcbf5513-797b-5a84-b5cf-eb04b5444708",status:"open",openedAt:"2026-01-01"})
  writeJson(join(root,".spec-ledger/claims/e13a3592-f92c-4e97-a288-e85dacb1009a.json"),{id:"e13a3592-f92c-4e97-a288-e85dacb1009a",kind:"spec",statement:"Tenants cannot access each other's data",required:true})
  return root
}
function deferred(response:"implement"|"revisit"="implement"):DeferredDecision {
  return {schemaVersion:1,id:"6eb1d93f-bc4d-5fa8-aa45-bfc6c3ab5e13",turnId:"bcbf5513-797b-5a84-b5cf-eb04b5444708",decision:"Defer tenant isolation",rationale:"Single user release",deferral:{deferred:"Isolate tenants",originSpecRef:"6fbba68d-7164-55a6-80f9-18dea06c91ce",when:{kind:"feature-planned",featureId:"multi-user"},response,gate:"before-feature-complete",...(response==="implement" ? {requirementRef:"e13a3592-f92c-4e97-a288-e85dacb1009a"} : {})}}
}
function activate(root:string) { sealWorkstream(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce","fixture");return activateDeferralsForWork(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce") }
function files(root:string):string { return JSON.stringify(readdirSync(root,{recursive:true}).sort()) }

test("old deferrals appear in planning without activating or making backlog candidates mandatory",()=> {
  const root=fixture()
  try {
    recordDeferredDecision(root,deferred())
    for(let n=2;n<90;n++) {const id=randomUUID();writeJson(join(root,`.spec-ledger/turns/${id}.json`),{schemaVersion:1,id,status:"closed",openedAt:"2026-01-01"})}
    const before=files(root)
    const result=backlog(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce")
    assert.equal(result.deferrals[0].decisionRef,"6eb1d93f-bc4d-5fa8-aa45-bfc6c3ab5e13")
    assert.equal(result.deferrals[0].state,"not-due")
    assert.equal(result.externalDiscovery.status,"not-configured")
    assert.equal(result.candidates.every(w=>w.optional),true)
    assert.equal(files(root),before)
    assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"fbc810b4-5087-528f-b1c3-ce1c02b88970"))
  } finally {rmSync(root,{recursive:true,force:true})}
})

test("activation survives retries, feature removal, and source decision deletion",()=> {
  const root=fixture()
  try {
    recordDeferredDecision(root,deferred())
    assert.equal(activate(root)[0].state,"due")
    const before=files(root)
    activateDeferralsForWork(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce")
    assert.equal(files(root),before)
    assert.equal(readdirSync(join(root,".spec-ledger/deferral-activations")).length,1)
    const ws=loadWorkstream(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce");ws.featureIds=[];writeWorkstream(root,ws)
    assert.equal(evaluateDeferrals(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce")[0].affected,true)
    assert.throws(()=>assertDeferralsSatisfied(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce"),/prevent completion/)
    rmSync(join(root,".spec-ledger/decisions/bcbf5513-797b-5a84-b5cf-eb04b5444708/6eb1d93f-bc4d-5fa8-aa45-bfc6c3ab5e13.json"))
    assert.equal(evaluateDeferrals(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce")[0].state,"unknown")
    assert.throws(()=>assertDeferralsSatisfied(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce"),/changed or removed/)
    assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"fbc810b4-5087-528f-b1c3-ce1c02b88970"))
  } finally {rmSync(root,{recursive:true,force:true})}
})

test("missing trigger, origin, and claim references remain unknown",()=> {
  for (const missing of ["feature","origin","claim"]) {
    const root=fixture()
    try {
      const d=deferred()
      if(missing==="feature") d.deferral!.when.featureId="missing"
      if(missing==="origin") d.deferral!.originSpecRef="5cd6e0f3-9596-573a-a1fb-a65b3009116f"
      if(missing==="claim") d.deferral!.requirementRef="missing"
      recordDeferredDecision(root,d)
      assert.equal(evaluateDeferrals(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce")[0].state,"unknown")
    } finally {rmSync(root,{recursive:true,force:true})}
  }
})

test("hard implementation gates require current behavior evidence and reject re-deferral",()=> {
  const root=fixture()
  try {
    recordDeferredDecision(root,deferred());activate(root)
    const path=join(root,".spec-ledger/bindings/49f4f2ca-45ef-4d2e-be19-a4fd8e068b39.json")
    writeJson(path,{id:"49f4f2ca-45ef-4d2e-be19-a4fd8e068b39",claimId:"e13a3592-f92c-4e97-a288-e85dacb1009a",kind:"check",locator:{type:"path",path:"product.ts"}})
    assert.throws(()=>assertDeferralsSatisfied(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce"),/paths and attestation/)
    const permission=permissionStatus(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce")
    assert.throws(()=>recordDeferralResolution(root,{...deferred(),id:"2f9c98cf-b3f0-5333-9589-efde5a7afecc",deferralResolution:{decisionRef:"6eb1d93f-bc4d-5fa8-aa45-bfc6c3ab5e13",action:"re-deferred",workstreamId:"6fbba68d-7164-55a6-80f9-18dea06c91ce",authorityRef:permission.authorityId!,revisionDigest:permission.revisionDigest}}),/hard requirements/)
    writeJson(path,{id:"49f4f2ca-45ef-4d2e-be19-a4fd8e068b39",claimId:"e13a3592-f92c-4e97-a288-e85dacb1009a",kind:"test",locator:{type:"results-row",resultsKey:"isolates"}})
    const ledger=loadLedger(root)
    writeJson(join(root,".spec-ledger/results/last.json"),{schemaVersion:1,producer:{name:"test",version:"1"},producedAt:new Date().toISOString(),rows:[{key:"isolates",outcome:"pass",sourceDigest:sourceFingerprint(root),checkDigest:checkFingerprint(ledger.claims.find(c=>c.id==="e13a3592-f92c-4e97-a288-e85dacb1009a")!,ledger.bindings.find(b=>b.id==="49f4f2ca-45ef-4d2e-be19-a4fd8e068b39")!)}]})
    assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce"))
    writeFileSync(join(root,"product.ts"),"isolation broken\n")
    assert.throws(()=>assertDeferralsSatisfied(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce"),/current passing evidence/)
  } finally {rmSync(root,{recursive:true,force:true})}
})

test("revisit resolution records real current authority, rejects invented authority and revoked approval",()=> {
  const root=fixture()
  try {
    recordDeferredDecision(root,deferred("revisit"));activate(root)
    const permission=permissionStatus(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce")
    const d:DeferredDecision={schemaVersion:1,id:"2f9c98cf-b3f0-5333-9589-efde5a7afecc",turnId:"bcbf5513-797b-5a84-b5cf-eb04b5444708",decision:"Retain single-user release",rationale:"Reviewed planned access and confirmed no shared tenancy",deferralResolution:{decisionRef:"6eb1d93f-bc4d-5fa8-aa45-bfc6c3ab5e13",action:"revisited",authorityRef:"9f205cad-3899-57d5-83d8-264f072cba95",workstreamId:"6fbba68d-7164-55a6-80f9-18dea06c91ce",revisionDigest:permission.revisionDigest}}
    assert.throws(()=>recordDeferralResolution(root,d),/current explicit authority/)
    d.deferralResolution!.authorityRef=permission.authorityId!
    recordDeferralResolution(root,d)
    assert.deepEqual(recordDeferralResolution(root,d),d)
    assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce"))
    recordAuthority(root,{action:"revoke",targetId:permission.authorityId,source:{kind:"agent-reported",reference:"fixture revoke"}})
    assert.throws(()=>assertDeferralsSatisfied(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce"),/authorized recorded revisit/)
  } finally {rmSync(root,{recursive:true,force:true})}
})

test("re-deferring a revisit preserves its history and gates the replacement when its feature arrives",()=> {
  const root=fixture()
  try {
    recordDeferredDecision(root,deferred("revisit"));activate(root)
    const permission=permissionStatus(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce")
    const replacement:DeferredDecision={...deferred("revisit"),id:"2f9c98cf-b3f0-5333-9589-efde5a7afecc",decision:"Revisit billing isolation with billing",rationale:"Current feature has no billing data; revisit when billing is planned",deferralResolution:{decisionRef:"6eb1d93f-bc4d-5fa8-aa45-bfc6c3ab5e13",action:"re-deferred",authorityRef:permission.authorityId!,workstreamId:"6fbba68d-7164-55a6-80f9-18dea06c91ce",revisionDigest:permission.revisionDigest}}
    replacement.deferral!.when.featureId="billing"
    recordDeferralResolution(root,replacement)
    assert.doesNotThrow(()=>assertDeferralsSatisfied(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce"))
    assert.equal(evaluateDeferrals(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce").find(d=>d.decisionRef==="6eb1d93f-bc4d-5fa8-aa45-bfc6c3ab5e13")!.state,"resolved")
    sealWorkstream(root,"fbc810b4-5087-528f-b1c3-ce1c02b88970","fixture")
    activateDeferralsForWork(root,"fbc810b4-5087-528f-b1c3-ce1c02b88970")
    assert.throws(()=>assertDeferralsSatisfied(root,"fbc810b4-5087-528f-b1c3-ce1c02b88970"),/2f9c98cf-b3f0-5333-9589-efde5a7afecc/)
    assert.throws(()=>recordDeferredDecision(root,{...deferred("revisit"),rationale:"Silently rewrite why we postponed"}),/different content/)
  } finally {rmSync(root,{recursive:true,force:true})}
})

test("malformed text, schema, activation, and resolution records never produce satisfaction",()=> {
  const root=fixture()
  try {
    const original=deferred("revisit")
    recordDeferredDecision(root,original)
    const decisionPath=join(root,".spec-ledger/decisions/bcbf5513-797b-5a84-b5cf-eb04b5444708/6eb1d93f-bc4d-5fa8-aa45-bfc6c3ab5e13.json")
    for (const field of ["deferred","originSpecRef","requirementRef"]) {
      writeJson(decisionPath,{...original,deferral:{...original.deferral,[field]:42}})
      assert.equal(evaluateDeferrals(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce")[0].state,"unknown")
    }
    writeJson(decisionPath,{...original,schemaVersion:2})
    assert.equal(evaluateDeferrals(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce")[0].state,"unknown")
    writeJson(decisionPath,original)
    activate(root)
    const permission=permissionStatus(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce")
    writeJson(join(root,".spec-ledger/decisions/bcbf5513-797b-5a84-b5cf-eb04b5444708/2f9c98cf-b3f0-5333-9589-efde5a7afecc.json"),{schemaVersion:1,id:"2f9c98cf-b3f0-5333-9589-efde5a7afecc",turnId:"bcbf5513-797b-5a84-b5cf-eb04b5444708",decision:"Reviewed",rationale:42,deferralResolution:{decisionRef:original.id,action:"revisited",authorityRef:permission.authorityId,workstreamId:"6fbba68d-7164-55a6-80f9-18dea06c91ce",revisionDigest:permission.revisionDigest}})
    assert.equal(evaluateDeferrals(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce")[0].state,"due")
    const receipt=join(root,".spec-ledger/deferral-activations",readdirSync(join(root,".spec-ledger/deferral-activations"))[0])
    writeJson(receipt,{schemaVersion:2,decision:original,workstreamId:"6fbba68d-7164-55a6-80f9-18dea06c91ce",activatedAt:"2026-01-01"})
    assert.equal(evaluateDeferrals(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce")[0].state,"unknown")
    writeJson(receipt,null)
    assert.equal(evaluateDeferrals(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce").some(d=>d.state==="unknown" && d.affected),true)
    assert.throws(()=>assertDeferralsSatisfied(root,"6fbba68d-7164-55a6-80f9-18dea06c91ce"),/prevent completion/)
  } finally {rmSync(root,{recursive:true,force:true})}
})
