import {randomUUID} from "node:crypto"
import {describe,it} from "node:test"
import assert from "node:assert/strict"
import {mkdtempSync,rmSync,writeFileSync,readFileSync,readdirSync,symlinkSync,mkdirSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {initLedger} from "../cli/init.js"
import {loadLedger,writeJson} from "../fs/load.js"
import {sealWorkstream} from "../workstream/load.js"
import {sourceFingerprint,checkFingerprint,contentHash} from "../evidence/fingerprint.js"
import {getSession} from "./project.js"
import {planRevision} from "../permission/authority.js"
import {loadWorkstream} from "../workstream/load.js"

function fixture(){
 const root=mkdtempSync(join(tmpdir(),"sl-evidence-break-"));initLedger(root,"evidence breaker")
 writeFileSync(join(root,"source.ts"),"source")
 writeJson(join(root,".spec-ledger/claims/02f2ae36-9568-53f9-bc0c-a25f0a7e3af4.json"),{id:"02f2ae36-9568-53f9-bc0c-a25f0a7e3af4",statement:"Behavior",required:true})
 writeJson(join(root,".spec-ledger/bindings/a56b72e7-48a0-5cd6-b5c2-20eb12257138.json"),{id:"a56b72e7-48a0-5cd6-b5c2-20eb12257138",claimId:"02f2ae36-9568-53f9-bc0c-a25f0a7e3af4",kind:"check",locator:{type:"results-row",resultsKey:"r"}})
 writeJson(join(root,".spec-ledger/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad.json"),{schemaVersion:1,id:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",status:"shaped",title:"Work",featureIds:["alpha"],acceptanceCriteria:["Behavior works","Unmapped behavior"],acceptanceClaimIds:{"AC-1":["02f2ae36-9568-53f9-bc0c-a25f0a7e3af4"]},policy:{requireSpecBreak:false,requireCodeBreak:false},suggestedSlices:[]})
 sealWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad","fixture")
 writeJson(join(root,".spec-ledger/turns/1c5a8e44-dd09-543a-97d5-bfe173becbaa.json"),{schemaVersion:1,id:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",status:"closed",intent:{workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",featureIds:["alpha"]}})
 return root
}
function result(root:string,duplicate=false){
 const ledger=loadLedger(root)
 const row={key:"r",outcome:"pass",detail:"Assertion passed",runId:"fixture-run",sourceDigest:sourceFingerprint(root),checkDigest:checkFingerprint(ledger.claims[0],ledger.bindings[0])}
 writeJson(join(root,".spec-ledger/results/last.json"),{schemaVersion:1,producedAt:"2026-09-04T00:00:00Z",producer:{name:"fixture",version:"1"},rows:duplicate?[row,{...row,outcome:"fail"}]:[row]})
}
function files(root:string){return Object.fromEntries(readdirSync(root,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>[join(e.parentPath,e.name),readFileSync(join(e.parentPath,e.name)).toString("base64")]))}

describe("workstream evidence adversarial",()=>{
 it("keeps stale pass historical and unmapped criteria missing",()=>{
  const root=fixture();try{
   result(root)
   assert.equal(getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!.criteria[0].claims[0].checks[0].outcome,"pass")
   writeFileSync(join(root,"source.ts"),"changed source")
   const session=getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!
   const check=session.criteria[0].claims[0].checks[0]
   assert.equal(check.outcome,"missing");assert.match(check.reason!,/stale/)
   assert.equal(check.recorded[0].outcome,"pass");assert.equal(check.recorded[0].runId,"fixture-run")
   assert.equal(check.recorded[0].receipt,null,"latest results timestamp must not be misattributed to a missing run")
   assert.equal(session.criteria[1].evidence,"missing")
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("exposes duplicate rows without choosing a winning pass and shows each missing check",()=>{
  const root=fixture();try{
   writeJson(join(root,".spec-ledger/bindings/bfad8fac-1ea2-55c8-b0a6-b635553f5ebe.json"),{id:"bfad8fac-1ea2-55c8-b0a6-b635553f5ebe",claimId:"02f2ae36-9568-53f9-bc0c-a25f0a7e3af4",kind:"check",locator:{type:"results-row",resultsKey:"absent"}})
   result(root,true)
   const claim=getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!.criteria[0].claims[0]
   assert.equal(claim.outcome,"fail")
   const duplicate=claim.checks.find(c=>c.id==="a56b72e7-48a0-5cd6-b5c2-20eb12257138")!
   assert.equal(duplicate.outcome,"fail");assert.equal(duplicate.recorded.length,2)
   assert.match(duplicate.reason!,/duplicate/)
   assert.equal(claim.checks.find(c=>c.id==="bfad8fac-1ea2-55c8-b0a6-b635553f5ebe")!.outcome,"missing")
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("does not execute a command or write records while showing evidence",()=>{
  const root=fixture();try{
   writeJson(join(root,".spec-ledger/bindings/eb6487d5-647c-5cee-8d00-e5530d3483ee.json"),{id:"eb6487d5-647c-5cee-8d00-e5530d3483ee",claimId:"02f2ae36-9568-53f9-bc0c-a25f0a7e3af4",kind:"check",locator:{type:"command",command:"touch SHOULD_NOT_EXIST"}})
   const before=files(root)
   const command=getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!.criteria[0].claims[0].checks.find(c=>c.id==="eb6487d5-647c-5cee-8d00-e5530d3483ee")!
   assert.equal(command.outcome,"missing");assert.equal(command.definition.command,"touch SHOULD_NOT_EXIST")
   assert.deepEqual(files(root),before)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("displays only bounded digest-matching confined text and never outside symlink contents",()=>{
  const root=fixture(),outside=mkdtempSync(join(tmpdir(),"sl-evidence-outside-"));try{
   const content="<script>not executable</script>\nObserved browser click"
   writeFileSync(join(root,"artifact.txt"),content)
   writeFileSync(join(root,"large.txt"),"x".repeat(65537))
   writeFileSync(join(outside,"secret.txt"),"synthetic private text")
   // Place the hostile link inside the ledger so unrelated source fingerprint behavior cannot mask artifact denial.
   symlinkSync(join(outside,"secret.txt"),join(root,".spec-ledger/escape.txt"))
   const dir=join(root,".spec-ledger/attachments/1c5a8e44-dd09-543a-97d5-bfe173becbaa");mkdirSync(dir,{recursive:true})
   const ids=new Map<string,string>();const attachmentId=(label:string)=>{if(!ids.has(label))ids.set(label,randomUUID());return ids.get(label)!}
   const add=(id:string,path:string,contentDigest?:string,mediaType="text/plain")=>writeJson(join(dir,`${attachmentId(id)}.json`),{schemaVersion:1,id:attachmentId(id),turnId:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",path,contentDigest,mediaType})
   add("valid","artifact.txt",contentHash(content));add("changed","artifact.txt",contentHash("old"));add("missing","missing.txt",contentHash("missing"));add("escape",".spec-ledger/escape.txt",contentHash("synthetic private text"));add("large","large.txt",contentHash("x".repeat(65537)));add("unhashed","artifact.txt");add("binary","artifact.txt",contentHash(content),"image/png");add("remote","https://invalid.example/evidence.txt",contentHash("remote"))
   const artifacts=getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!.artifacts
   const by=(id:string)=>artifacts.find(a=>a.id===attachmentId(id))!
   assert.equal(by("valid").status,"verified");assert.equal(by("valid").text,content)
   assert.equal(by("changed").status,"changed");assert.equal(by("unhashed").status,"unverified");assert.equal(by("binary").status,"unsupported")
   for(const id of ["missing","escape","large","remote"])assert.equal(by(id).status,"unavailable",id)
   for(const a of artifacts.filter(a=>a.id!==attachmentId("valid")))assert.equal(a.text,null,a.id)
  }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true})}
 })
 it("keeps review findings and distinguishes current spec review from stale code review",()=>{
  const root=fixture();try{
   const review={schemaVersion:1,id:"ae993426-55ab-5610-9784-6f1a5efe7241",turnId:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",target:"code",verdict:"approve",plainSummary:"Behavior was checked.",treeDigest:sourceFingerprint(root),findings:[{id:"8bb69d5c-f3e3-5068-9b5c-4d21327f1121",plainImpact:"A limitation remains."}],residualRisks:["Bounded review only"]}
   writeJson(join(root,".spec-ledger/reviews/turns/1c5a8e44-dd09-543a-97d5-bfe173becbaa/ae993426-55ab-5610-9784-6f1a5efe7241.json"),review)
   writeJson(join(root,".spec-ledger/reviews/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad/caccfcbc-e114-5be4-a20d-0637fddfbb90.json"),{schemaVersion:1,id:"caccfcbc-e114-5be4-a20d-0637fddfbb90",workstreamId:"2b74bc14-227a-5c05-b2ed-1c32d9703cad",target:"spec",verdict:"approve",plainSummary:"The scope is clear.",revisionDigest:planRevision(root,loadWorkstream(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad"))})
   assert.equal(getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!.reviews.find(r=>r.id===review.id)!.current,true)
   writeFileSync(join(root,"source.ts"),"new implementation")
   const reviews=getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!.reviews
   const code=reviews.find(r=>r.id===review.id)!
   assert.equal(code.current,false);assert.equal(code.verdict,"approve")
   assert.equal(code.findings[0].plainImpact,"A limitation remains.");assert.deepEqual(code.residualRisks,["Bounded review only"])
   assert.equal(reviews.find(r=>r.target==="spec")!.current,true)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("explains why file-presence checks do not prove a behavioral requirement",()=>{
  const root=fixture();try{
   writeJson(join(root,".spec-ledger/bindings/a56b72e7-48a0-5cd6-b5c2-20eb12257138.json"),{id:"a56b72e7-48a0-5cd6-b5c2-20eb12257138",claimId:"02f2ae36-9568-53f9-bc0c-a25f0a7e3af4",kind:"structural",locator:{type:"path",path:"source.ts"}})
   const criterion=getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!.criteria[0]
   assert.equal(criterion.evidence,"missing");assert.match(criterion.reason!,/behavior/i)
   assert.equal(criterion.claims[0].checks[0].outcome,"pass");assert.equal(criterion.claims[0].checks[0].recorded.length,0)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("attributes a timestamp only when the immutable receipt contains that exact row",()=>{
  const root=fixture();try{
   result(root)
   const results=JSON.parse(readFileSync(join(root,".spec-ledger/results/last.json"),"utf8"))
   const path=join(root,".spec-ledger/evidence/runs/fixture-run.json")
   writeJson(path,{...results,rows:[{...results.rows[0],detail:"different observation"}]})
   assert.equal(getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!.criteria[0].claims[0].checks[0].recorded[0].receipt,null)
   writeJson(path,results)
   assert.equal(getSession(root,"2b74bc14-227a-5c05-b2ed-1c32d9703cad").session!.criteria[0].claims[0].checks[0].recorded[0].receipt!.producedAt,results.producedAt)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
})
