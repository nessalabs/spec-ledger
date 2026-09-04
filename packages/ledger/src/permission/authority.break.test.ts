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
  for(const id of ["W-001","W-002"]) writeJson(join(root,`.spec-ledger/workstreams/${id}.json`),{
    schemaVersion:1,id,status:"shaped",title:"Scoped work",featureIds:["alpha"],createdAt:"2026-01-01T00:00:00Z",policy:{requireSpecBreak:false},trust:{},
    suggestedSlices:[{id:"SLC-01",title:"Build",kind:"vertical",acceptance:["Works"]}],
  })
  return root
}
function revision(root:string) {return planRevision(root,loadWorkstream(root,"W-001"))}

describe("delegated authority adversarial",()=>{
  it("enforces explicit feature exclusions and immutable authority retries",()=>{
    const root=fixture()
    try {
      const input={id:"AUTH-standing",action:"grant" as const,mode:"standing" as const,featureIds:["alpha"],source}
      const first=recordAuthority(root,input)
      assert.deepEqual(recordAuthority(root,input),first)
      assert.throws(()=>recordAuthority(root,{...input,featureIds:["alpha","beta"]}),/different content/)
      recordAuthority(root,{action:"restrict",workstreamId:"W-001",excludeFeatureIds:["alpha"],source})
      assert.equal(permissionStatus(root,"W-001").allowed,false)
      assert.equal(permissionStatus(root,"W-002").allowed,true)
      const ws=loadWorkstream(root,"W-002");ws.featureIds.push("beta")
      writeJson(join(root,".spec-ledger/workstreams/W-002.json"),ws)
      assert.equal(permissionStatus(root,"W-002").allowed,false)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("requires a real current spec review before snapshotting a revised delegated plan",()=>{
    const root=fixture()
    try {
      const path=join(root,".spec-ledger/workstreams/W-001.json")
      const ws=loadWorkstream(root,"W-001")
      ws.policy!.requireSpecBreak=true
      writeJson(path,{...ws,specBreakReviewId:"W-001/SR-01"})
      recordAuthority(root,{action:"grant",mode:"request",workstreamId:"W-001",featureIds:["alpha"],source})
      recordSpecReview(root,{schemaVersion:1,id:"W-001/SR-01",workstreamId:"W-001",target:"spec",kind:"adversarial",reviewer:"fixture",verdict:"approve",summary:"Synthetic reviewed plan",plainSummary:"The plan has clear acceptance."})
      const first=prepareExecutablePlan(root,"W-001")
      assert.equal(first.seal?.revision,1)
      const changed=loadWorkstream(root,"W-001")
      changed.suggestedSlices![0].acceptance.push("New acceptance after review")
      writeJson(path,changed)
      assert.throws(()=>prepareExecutablePlan(root,"W-001"),/current spec review/)
      writeJson(path,{...changed,specBreakReviewId:"W-001/SR-02"})
      recordSpecReview(root,{schemaVersion:1,id:"W-001/SR-02",workstreamId:"W-001",target:"spec",kind:"adversarial",reviewer:"fixture",verdict:"approve",summary:"Synthetic rereviewed plan",plainSummary:"The revised plan has clear acceptance."})
      assert.equal(prepareExecutablePlan(root,"W-001").seal?.revision,2)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("raw denial records prevent the same standing delegation from restarting renamed work",()=>{
    const root=fixture()
    try {
      recordAuthority(root,{id:"AUTH-standing",action:"grant",mode:"standing",featureIds:["alpha"],source})
      recordAuthority(root,{action:"deny",workstreamId:"W-001",revisionDigest:revision(root),source})
      const ws=loadWorkstream(root,"W-001");ws.title="Same request with a renamed plan"
      writeJson(join(root,".spec-ledger/workstreams/W-001.json"),ws)
      assert.equal(permissionStatus(root,"W-001").allowed,false)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("refuses denied work through CLI even when context collection is explicitly skipped",()=>{
    const root=fixture()
    try {
      recordAuthority(root,{action:"grant",mode:"standing",featureIds:["alpha"],source})
      recordAuthority(root,{action:"deny",workstreamId:"W-001",revisionDigest:revision(root),source})
      const run=spawnSync(process.execPath,[fileURLToPath(new URL("../cli/main.js",import.meta.url)),"work","--root",root,"--workstream","W-001","--slice","SLC-01","--feature","alpha","--goal","Should refuse","--no-context","--no-context-reason","fixture explicitly tests permission gate"],{encoding:"utf8"})
      assert.notEqual(run.status,0)
      assert.match(run.stderr+run.stdout,/not authorized|permission|denial/i)
      assert.equal(loadWorkstream(root,"W-001").seal,undefined)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("distinguishes revision/request/standing authority and revocation without broader fallback",()=>{
    const root=fixture()
    try {
      assert.equal(permissionStatus(root,"W-001").allowed,false)
      recordAuthority(root,{id:"AUTH-standing",action:"grant",mode:"standing",featureIds:["alpha"],source})
      assert.equal(permissionStatus(root,"W-001").mode,"standing")
      recordAuthority(root,{id:"AUTH-request",action:"grant",mode:"request",workstreamId:"W-001",featureIds:["alpha"],source})
      assert.equal(permissionStatus(root,"W-001").mode,"request")
      recordAuthority(root,{action:"revoke",targetId:"AUTH-request",source})
      assert.equal(permissionStatus(root,"W-001").allowed,false)
      assert.equal(permissionStatus(root,"W-002").allowed,true)
      recordAuthority(root,{id:"AUTH-revision",action:"grant",mode:"revision",workstreamId:"W-001",featureIds:["alpha"],revisionDigest:revision(root),source})
      assert.equal(permissionStatus(root,"W-001").mode,"revision")
      recordAuthority(root,{action:"deny",workstreamId:"W-001",revisionDigest:revision(root),source})
      assert.equal(permissionStatus(root,"W-001").allowed,false)
      assert.throws(()=>prepareExecutablePlan(root,"W-001"),/not authorized/)
      assert.equal(permissionStatus(root,"W-002").allowed,true)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("requires revision reapproval after acceptance changes and never invents host consent",()=>{
    const root=fixture()
    try {
      recordAuthority(root,{action:"grant",mode:"revision",workstreamId:"W-001",featureIds:["alpha"],revisionDigest:revision(root),source})
      assert.equal(permissionStatus(root,"W-001").provenance,"agent-reported")
      const ws=loadWorkstream(root,"W-001")
      ws.suggestedSlices![0].acceptance.push("Changed obligation")
      writeJson(join(root,".spec-ledger/workstreams/W-001.json"),ws)
      assert.equal(permissionStatus(root,"W-001").allowed,false)
      assert.throws(()=>recordAuthority(root,{action:"grant",mode:"standing",featureIds:["alpha"],source:{kind:"host-verified" as "agent-reported",reference:"claimed"}}),/no trusted host/)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("does not accept a fabricated spec-review reference when a delegated plan requires review",()=>{
    const root=fixture()
    try {
      const ws=loadWorkstream(root,"W-001")
      ws.policy!.requireSpecBreak=true
      writeJson(join(root,".spec-ledger/workstreams/W-001.json"),{...ws,specBreakReviewId:"W-001/SR-does-not-exist"})
      recordAuthority(root,{action:"grant",mode:"request",workstreamId:"W-001",featureIds:["alpha"],source})
      assert.throws(()=>prepareExecutablePlan(root,"W-001"),/review/i)
    }finally{rmSync(root,{recursive:true,force:true})}
  })
  it("applies corrections only in scope, excludes inferred preferences, and hashes same-ID content",()=>{
    const root=fixture()
    try {
      sealWorkstream(root,"W-001","fixture")
      const before=getVerticalContext(root,"W-001","SLC-01").contextDigest
      recordLearning(root,{id:"LN-one",statement:"Use explicit errors",workstreamId:"W-001",source:{kind:"user-reported",reference:"fixture"}})
      recordLearning(root,{id:"LN-inferred",statement:"Imagined global preference",source:{kind:"agent-inferred",reference:"model guess"}})
      assert.deepEqual(applicableLearnings(root,"W-002",["alpha"]),[])
      assert.deepEqual(applicableLearnings(root,"W-001",["alpha"]).map(x=>x.id),["LN-one"])
      const after=getVerticalContext(root,"W-001","SLC-01").contextDigest
      assert.notEqual(before,after)
      const path=join(root,".spec-ledger/learnings/LN-one.json")
      const record=JSON.parse(readFileSync(path,"utf8"));record.statement="Different instruction under same ID"
      writeFileSync(path,JSON.stringify(record))
      assert.notEqual(getVerticalContext(root,"W-001","SLC-01").contextDigest,after)
      recordLearning(root,{id:"LN-two",statement:"Use revised errors",workstreamId:"W-001",supersedes:["LN-one"],source:{kind:"user-reported",reference:"new correction"}})
      assert.deepEqual(applicableLearnings(root,"W-001",["alpha"]).map(x=>x.id),["LN-two"])
    }finally{rmSync(root,{recursive:true,force:true})}
  })
})
