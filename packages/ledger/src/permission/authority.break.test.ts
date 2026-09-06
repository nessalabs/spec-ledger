import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { initLedger } from "../cli/init.js"
import { writeJson } from "../fs/load.js"
import { loadWorkstream, sealWorkstream } from "../workstream/load.js"
import { recordAuthority, permissionStatus, planRevision, prepareExecutablePlan, recordSpecReview } from "./authority.js"
import { recordLearning, applicableLearnings } from "../compass/learnings.js"
import { getVerticalContext } from "../context/vertical.js"

const source={kind:"agent-reported" as const,reference:"synthetic explicit fixture instruction"}
function fixture() {
  const root=mkdtempSync(join(tmpdir(),"sl-permission-break-"))
  initLedger(root,"authority breaker")
  for(const id of ["2b74bc14-227a-5c05-b2ed-1c32d9703cad","d30877ac-696d-5e71-b593-783728a4c76d"]) writeJson(join(root,`.spec-ledger/workstreams/${id}.json`),{
    schemaVersion:1,id,status:"shaped",title:"Scoped work",featureIds:["alpha"],createdAt:"2026-01-01T00:00:00Z",policy:{requireSpecBreak:false},trust:{},
    suggestedSlices:[{id:"886b091f-57f9-5f69-9e74-f0b50275d693",title:"Build",kind:"vertical",acceptance:["Works"]}],
  })
  return root
}
function revision(root:string) {return planRevision(root,loadWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad"))}

describe("delegated authority adversarial",()=>{
  it("enforces explicit feature exclusions and immutable authority retries",()=>{
    const root=fixture()
    try {
      const input={id:"bcdc3a05-ed95-54dc-815b-111990b243b1",action:"grant" as const,mode:"standing" as const,featureIds:["alpha"],source}
      const first=recordAuthority(root,input)
      assert.deepEqual(recordAuthority(root,input),first)
      assert.throws(()=>recordAuthority(root,{...input,featureIds:["alpha","beta"]}),/different content/)
      recordAuthority(root,{action:"restrict",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",excludeFeatureIds:["alpha"],source})
      assert.equal(permissionStatus(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").allowed,false)
      assert.equal(permissionStatus(root,"d30877ac-696d-5e71-b593-783728a4c76d").allowed,true)
      const ws=loadWorkstream(root,"d30877ac-696d-5e71-b593-783728a4c76d");ws.featureIds.push("beta")
      writeJson(join(root,".spec-ledger/workstreams/d30877ac-696d-5e71-b593-783728a4c76d.json"),ws)
      assert.equal(permissionStatus(root,"d30877ac-696d-5e71-b593-783728a4c76d").allowed,false)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("requires a real current spec review before snapshotting a revised delegated plan",()=>{
    const root=fixture()
    try {
      const path=join(root,".spec-ledger/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad.json")
      const ws=loadWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")
      ws.policy!.requireSpecBreak=true
      writeJson(path,{...ws,specBreakReviewId:"caccfcbc-e114-5be4-a20d-0637fddfbb90"})
      recordAuthority(root,{action:"grant",mode:"request",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",featureIds:["alpha"],source})
      recordSpecReview(root,{schemaVersion:1,id:"caccfcbc-e114-5be4-a20d-0637fddfbb90",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",target:"spec",kind:"adversarial",reviewer:"fixture",verdict:"approve",summary:"Synthetic reviewed plan",plainSummary:"The plan has clear acceptance."})
      const first=prepareExecutablePlan(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")
      assert.equal(first.seal?.revision,1)
      const changed=loadWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")
      changed.suggestedSlices![0].acceptance.push("New acceptance after review")
      writeJson(path,changed)
      assert.throws(()=>prepareExecutablePlan(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad"),/current spec review/)
      writeJson(path,{...changed,specBreakReviewId:"146a11e7-21c2-50ec-a60b-8cfbb9f997b4"})
      recordSpecReview(root,{schemaVersion:1,id:"146a11e7-21c2-50ec-a60b-8cfbb9f997b4",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",target:"spec",kind:"adversarial",reviewer:"fixture",verdict:"approve",summary:"Synthetic rereviewed plan",plainSummary:"The revised plan has clear acceptance."})
      assert.equal(prepareExecutablePlan(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").seal?.revision,2)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("raw denial records prevent the same standing delegation from restarting renamed work",()=>{
    const root=fixture()
    try {
      recordAuthority(root,{id:"bcdc3a05-ed95-54dc-815b-111990b243b1",action:"grant",mode:"standing",featureIds:["alpha"],source})
      recordAuthority(root,{action:"deny",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",revisionDigest:revision(root),source})
      const ws=loadWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad");ws.title="Same request with a renamed plan"
      writeJson(join(root,".spec-ledger/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad.json"),ws)
      assert.equal(permissionStatus(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").allowed,false)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("refuses denied work through CLI even when context collection is explicitly skipped",()=>{
    const root=fixture()
    try {
      recordAuthority(root,{action:"grant",mode:"standing",featureIds:["alpha"],source})
      recordAuthority(root,{action:"deny",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",revisionDigest:revision(root),source})
      const run=spawnSync(process.execPath,[fileURLToPath(new URL("../cli/main.js",import.meta.url)),"work","--root",root,"--workstream","2b74bc14-227a-5c05-b2ed-1c32d9703cad","--slice","886b091f-57f9-5f69-9e74-f0b50275d693","--feature","alpha","--goal","Should refuse","--no-context","--no-context-reason","fixture explicitly tests permission gate"],{encoding:"utf8"})
      assert.notEqual(run.status,0)
      assert.match(run.stderr+run.stdout,/not authorized|permission|denial/i)
      assert.equal(loadWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").seal,undefined)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("distinguishes revision/request/standing authority and revocation without broader fallback",()=>{
    const root=fixture()
    try {
      assert.equal(permissionStatus(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").allowed,false)
      recordAuthority(root,{id:"bcdc3a05-ed95-54dc-815b-111990b243b1",action:"grant",mode:"standing",featureIds:["alpha"],source})
      assert.equal(permissionStatus(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").mode,"standing")
      recordAuthority(root,{id:"abc7b6d3-d0f6-5bb2-a5ad-bf51ab00eba0",action:"grant",mode:"request",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",featureIds:["alpha"],source})
      assert.equal(permissionStatus(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").mode,"request")
      recordAuthority(root,{action:"revoke",targetId:"abc7b6d3-d0f6-5bb2-a5ad-bf51ab00eba0",source})
      assert.equal(permissionStatus(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").allowed,false)
      assert.equal(permissionStatus(root,"d30877ac-696d-5e71-b593-783728a4c76d").allowed,true)
      recordAuthority(root,{id:"a54b16c0-c041-5d56-9e4e-1711898ea53a",action:"grant",mode:"revision",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",featureIds:["alpha"],revisionDigest:revision(root),source})
      assert.equal(permissionStatus(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").mode,"revision")
      recordAuthority(root,{action:"deny",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",revisionDigest:revision(root),source})
      assert.equal(permissionStatus(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").allowed,false)
      assert.throws(()=>prepareExecutablePlan(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad"),/not authorized/)
      assert.equal(permissionStatus(root,"d30877ac-696d-5e71-b593-783728a4c76d").allowed,true)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("requires revision reapproval after acceptance changes and never invents host consent",()=>{
    const root=fixture()
    try {
      recordAuthority(root,{action:"grant",mode:"revision",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",featureIds:["alpha"],revisionDigest:revision(root),source})
      assert.equal(permissionStatus(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").provenance,"agent-reported")
      const ws=loadWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")
      ws.suggestedSlices![0].acceptance.push("Changed obligation")
      writeJson(join(root,".spec-ledger/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad.json"),ws)
      assert.equal(permissionStatus(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").allowed,false)
      assert.throws(()=>recordAuthority(root,{action:"grant",mode:"standing",featureIds:["alpha"],source:{kind:"host-verified" as "agent-reported",reference:"claimed"}}),/no trusted host/)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("does not accept a fabricated spec-review reference when a delegated plan requires review",()=>{
    const root=fixture()
    try {
      const ws=loadWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad")
      ws.policy!.requireSpecBreak=true
      writeJson(join(root,".spec-ledger/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad.json"),{...ws,specBreakReviewId:"798eb504-ad0c-5174-b067-44f682e57a9c"})
      recordAuthority(root,{action:"grant",mode:"request",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",featureIds:["alpha"],source})
      assert.throws(()=>prepareExecutablePlan(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad"),/review/i)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("applies corrections only in scope, excludes inferred preferences, and hashes same-ID content",()=>{
    const root=fixture()
    try {
      sealWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad","fixture")
      const before=getVerticalContext(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad","886b091f-57f9-5f69-9e74-f0b50275d693").contextDigest
      recordLearning(root,{id:"dd0edad1-578d-5078-acc0-6cb86439a23f",statement:"Use explicit errors",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",source:{kind:"user-reported",reference:"fixture"}})
      recordLearning(root,{id:"5f26b7ae-9ede-5e70-b6d5-882630ff5312",statement:"Imagined global preference",source:{kind:"agent-inferred",reference:"model guess"}})
      assert.deepEqual(applicableLearnings(root,"d30877ac-696d-5e71-b593-783728a4c76d",["alpha"]),[])
      assert.deepEqual(applicableLearnings(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad",["alpha"]).map(x=>x.id),["dd0edad1-578d-5078-acc0-6cb86439a23f"])
      const after=getVerticalContext(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad","886b091f-57f9-5f69-9e74-f0b50275d693").contextDigest
      assert.notEqual(before,after)
      const path=join(root,".spec-ledger/learnings/dd0edad1-578d-5078-acc0-6cb86439a23f.json")
      const record=JSON.parse(readFileSync(path,"utf8"));record.statement="Different instruction under same ID"
      writeFileSync(path,JSON.stringify(record))
      assert.notEqual(getVerticalContext(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad","886b091f-57f9-5f69-9e74-f0b50275d693").contextDigest,after)
      recordLearning(root,{id:"96532a57-4f42-596f-a4be-3d0df2f35eb6",statement:"Use revised errors",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",supersedes:["dd0edad1-578d-5078-acc0-6cb86439a23f"],source:{kind:"user-reported",reference:"new correction"}})
      assert.deepEqual(applicableLearnings(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad",["alpha"]).map(x=>x.id),["96532a57-4f42-596f-a4be-3d0df2f35eb6"])
    }finally{rmSync(root,{recursive:true,force:true})}
  })
})
