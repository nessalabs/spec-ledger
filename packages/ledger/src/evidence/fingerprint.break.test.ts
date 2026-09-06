import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import { initLedger } from "../cli/init.js"
import { loadLedger, writeJson } from "../fs/load.js"
import { sourceFingerprint, checkFingerprint, contentHash, localArtifactPath } from "./fingerprint.js"
import { verifyLedger } from "../verify/verify.js"
import { checkLedger } from "../verify/execute.js"
import { computeTreeDigest } from "../git/tree.js"
import { writeReview, codeBreakSatisfied } from "../reviews/load.js"
import { recordEvidence } from "./record.js"
import { alignCheck } from "../align/check.js"

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sl-fingerprint-break-"))
  initLedger(root, "fingerprint breaker")
  writeFileSync(join(root, "source.ts"), "export const value = 1\n")
  writeJson(join(root, ".spec-ledger/claims/02f2ae36-9568-53f9-bc0c-a25f0a7e3af4.json"), { id: "02f2ae36-9568-53f9-bc0c-a25f0a7e3af4", statement: "Implementation is checked", required: true })
  writeJson(join(root, ".spec-ledger/bindings/a56b72e7-48a0-5cd6-b5c2-20eb12257138.json"), {id:"a56b72e7-48a0-5cd6-b5c2-20eb12257138",claimId:"02f2ae36-9568-53f9-bc0c-a25f0a7e3af4",kind:"check",locator:{type:"results-row",resultsKey:"r"}})
  return root
}
function stamp(root: string) {
  const ledger = loadLedger(root)
  ledger.results = {schemaVersion:1,producedAt:"2026-09-04T00:00:00Z",producer:{name:"breaker",version:"1"},rows:[{
    key:"r",outcome:"pass",sourceDigest:sourceFingerprint(root)!,checkDigest:checkFingerprint(ledger.claims[0],ledger.bindings[0]),
  }]}
  return ledger
}

describe("evidence freshness adversarial", () => {
  it("does not let a closed turn reuse its old waiver or approval after source changes", () => {
    const root=fixture()
    const git=(...args:string[])=>execFileSync("git",args,{cwd:root,encoding:"utf8"})
    try {
      git("init");git("config","user.name","Test");git("config","user.email","test@example.invalid")
      git("add",".");git("commit","-m","initial")
      const base=git("rev-parse","HEAD").trim(), digest=computeTreeDigest(root)
      writeJson(join(root,".spec-ledger/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad.json"),{id:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",status:"active",featureIds:[],policy:{requireAlignApprove:true,allowExplicitAlignSkip:true},suggestedSlices:[{id:"886b091f-57f9-5f69-9e74-f0b50275d693",expectedPaths:[]}]})
      writeJson(join(root,".spec-ledger/turns/1c5a8e44-dd09-543a-97d5-bfe173becbaa.json"),{id:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",status:"closed",opened:{producedBy:"builder",baseCommit:base},intent:{workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",sliceId:"886b091f-57f9-5f69-9e74-f0b50275d693",featureIds:[]},facts:{commit:base,files:[{path:"source.ts",kind:"modified"}],verify:{treeDigest:digest}}})
      writeJson(join(root,".spec-ledger/align-waivers/6c1c61ec-d8f4-5d52-9a35-697ddf6c95e8.json"),{schemaVersion:1,id:"6c1c61ec-d8f4-5d52-9a35-697ddf6c95e8",turnId:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",treeDigest:digest,reason:"Synthetic fixture scoped waiver for source.ts",actor:"fixture"})
      writeReview(root,{schemaVersion:1,id:"ae993426-55ab-5610-9784-6f1a5efe7241",turnId:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",kind:"human",reviewer:"agent:align:fixture",verdict:"approve",plainSummary:"The source scope is covered.",summary:"Synthetic scoped approval",treeDigest:digest,coverageSource:"user",uncoveredPaths:[]})
      assert.equal(alignCheck(root).ok,true)
      writeFileSync(join(root,"source.ts"),"changed after close")
      assert.equal(alignCheck(root).ok,false,"closed-turn digest rescued stale waiver/approval")
    } finally {rmSync(root,{recursive:true,force:true})}
  })
  it("binds code review to source content while excluding declared evidence outputs", () => {
    const root=fixture()
    try {
      const path="docs/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad/evidence/run-1/output.txt"
      mkdirSync(join(root,"docs/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad/evidence/run-1"),{recursive:true})
      const config=loadLedger(root).config
      config.generatedArtifactPaths=[path]
      writeJson(join(root,".spec-ledger/ledger.json"),config)
      const review=writeReview(root,{schemaVersion:1,id:"ae993426-55ab-5610-9784-6f1a5efe7241",turnId:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",kind:"adversarial",target:"code",reviewer:"breaker",verdict:"approve",plainSummary:"The check passes.",summary:"Synthetic review fixture",killersCited:["fixture"]})
      assert.ok(codeBreakSatisfied([review],computeTreeDigest(root)))
      writeFileSync(join(root,path),"generated evidence")
      assert.ok(codeBreakSatisfied([review],computeTreeDigest(root)),"declared generated output invalidated unchanged source review")
      writeFileSync(join(root,"source.ts"),"changed source")
      assert.equal(codeBreakSatisfied([review],computeTreeDigest(root)),false)
    } finally {rmSync(root,{recursive:true,force:true})}
  })
  it("records current external evidence idempotently and refuses stale or escaping submissions", () => {
    const root=fixture()
    try {
      const ledger=stamp(root)
      const input={bindingId:"a56b72e7-48a0-5cd6-b5c2-20eb12257138",outcome:"pass" as const,producer:{name:"external fixture",version:"1"},sourceDigest:ledger.results!.rows[0].sourceDigest!,checkDigest:ledger.results!.rows[0].checkDigest!,runId:"run-1"}
      const first=recordEvidence(root,input)
      assert.deepEqual(recordEvidence(root,input),first)
      assert.throws(()=>recordEvidence(root,{...input,outcome:"fail"}),/run id/)
      assert.throws(()=>recordEvidence(root,{...input,runId:"run-2",artifactPaths:["../outside.txt"]}))
      writeFileSync(join(root,"source.ts"),"changed")
      assert.throws(()=>recordEvidence(root,{...input,runId:"run-2"}),/inputs/)
      assert.equal(verifyLedger(loadLedger(root)).claims[0].outcome,"missing")
    } finally {rmSync(root,{recursive:true,force:true})}
  })
  it("rejects legacy evidence and evidence replayed after source or same-ID check changes", () => {
    const root = fixture()
    try {
      const ledger = stamp(root)
      assert.equal(verifyLedger(ledger).ok,true)
      const row = ledger.results!.rows[0]
      const digest = row.sourceDigest
      delete row.sourceDigest
      assert.equal(verifyLedger(ledger).claims[0].outcome,"missing")
      row.sourceDigest = digest
      writeFileSync(join(root,"new-untracked.ts"),"new source")
      assert.equal(verifyLedger(ledger).claims[0].outcome,"missing")
      rmSync(join(root,"new-untracked.ts"))
      writeFileSync(join(root,"source.ts"),"same path, changed content")
      assert.equal(verifyLedger(ledger).claims[0].outcome,"missing")
      const fresh = stamp(root)
      fresh.claims[0].statement = "A different obligation with the same ID"
      assert.equal(verifyLedger(fresh).claims[0].outcome,"missing")
      const check = stamp(root)
      check.bindings[0].locator.note = "Changed check metadata"
      assert.equal(verifyLedger(check).claims[0].outcome,"missing")
    } finally {rmSync(root,{recursive:true,force:true})}
  })
  it("retains evidence across ledger metadata and content-preserving commits", () => {
    const root=fixture()
    const git=(...args:string[])=>execFileSync("git",args,{cwd:root,stdio:"pipe"})
    try {
      git("init");git("config","user.name","Test");git("config","user.email","test@example.invalid")
      git("add",".")
      const before=sourceFingerprint(root)
      git("commit","-m","initial content")
      assert.equal(sourceFingerprint(root),before)
      writeJson(join(root,".spec-ledger/progress.json"),{changed:"narrative only"})
      assert.equal(sourceFingerprint(root),before)
      git("add",".");git("commit","-m","metadata only")
      assert.equal(sourceFingerprint(root),before)
    } finally {rmSync(root,{recursive:true,force:true})}
  })
  it("invalidates results if a successful command changes its own source inputs", () => {
    const root=fixture()
    try {
      writeJson(join(root,".spec-ledger/bindings/a56b72e7-48a0-5cd6-b5c2-20eb12257138.json"),{id:"a56b72e7-48a0-5cd6-b5c2-20eb12257138",claimId:"02f2ae36-9568-53f9-bc0c-a25f0a7e3af4",kind:"check",locator:{type:"command",command:"printf changed > source.ts"}})
      const report=checkLedger(root)
      assert.equal(report.ok,false)
      assert.equal(report.claims[0].outcome,"missing")
      assert.equal(readFileSync(join(root,"source.ts"),"utf8"),"changed")
    } finally {rmSync(root,{recursive:true,force:true})}
  })
  it("checks required artifacts even when their declared output path is excluded from source hashing", () => {
    const root=fixture()
    const outside=mkdtempSync(join(tmpdir(),"sl-artifact-outside-"))
    try {
      const path="docs/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad/evidence/run-1/output.txt"
      mkdirSync(join(root,"docs/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad/evidence/run-1"),{recursive:true})
      writeFileSync(join(root,path),"proof")
      const ledger=stamp(root)
      ledger.config.generatedArtifactPaths=[path]
      ledger.results!.rows[0].sourceDigest=sourceFingerprint(root,[path])!
      ledger.results!.rows[0].artifacts=[{path,sha256:contentHash("proof"),required:true}]
      assert.equal(verifyLedger(ledger).ok,true)
      writeFileSync(join(root,path),"tampered")
      assert.equal(verifyLedger(ledger).claims[0].outcome,"missing")
      rmSync(join(root,path))
      assert.equal(verifyLedger(ledger).claims[0].outcome,"missing")
      writeFileSync(join(outside,"secret.txt"),"proof")
      symlinkSync(join(outside,"secret.txt"),join(root,path))
      assert.throws(()=>localArtifactPath(root,path))
      assert.equal(verifyLedger(ledger).claims[0].outcome,"missing")
      assert.throws(()=>localArtifactPath(root,"../secret.txt"))
      assert.equal(sourceFingerprint(root,["source.ts"]),null)
    } finally {rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true})}
  })
})
