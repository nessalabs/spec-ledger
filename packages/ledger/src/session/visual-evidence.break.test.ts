import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { initLedger } from "../cli/init.js"
import { writeJson } from "../fs/load.js"
import { sealWorkstream, loadWorkstream } from "../workstream/load.js"
import { planRevision } from "../permission/authority.js"
import { computeTreeDigest } from "../git/tree.js"
import { getSession } from "./project.js"
import { attachmentEvidence } from "./evidence.js"
import { contentHash } from "../evidence/fingerprint.js"
import type { EpisodeAttachment } from "../types.js"
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP2kAAAAASUVORK5CYII=", "base64")
function fixture() {
 const root=mkdtempSync(join(tmpdir(),"sl-visual-break-"))
 const record=(path:string, bytes:Buffer, mediaType="image/png")=>{writeFileSync(join(root,path),bytes);return {schemaVersion:1,id:"0588d0c0-0e40-5619-a485-c6094a07b6c7",turnId:"1c5a8e44-dd09-543a-97d5-bfe173becbaa",path,mediaType,contentDigest:contentHash(bytes)} as EpisodeAttachment}
 return {root,record,cleanup:()=>rmSync(root,{recursive:true,force:true})}
}
test("visual breaker: digest mismatch, remote paths, type mismatch and escaping symlinks never expose image bytes",()=>{
 const f=fixture(),outside=fixture()
 try {
  const a=f.record("image.png",png)
  assert.equal(attachmentEvidence(f.root,a).status,"verified")
  for(const bad of [{...a,contentDigest:contentHash("other")},{...a,path:"https://example.invalid/image.png"},{...a,mediaType:"image/jpeg"},{...a,mediaType:"image/svg+xml"}])assert.equal(attachmentEvidence(f.root,bad).imageDataUrl,null)
  outside.record("private.png",png);symlinkSync(join(outside.root,"private.png"),join(f.root,"escape.png"))
  assert.equal(attachmentEvidence(f.root,{...a,path:"escape.png"}).status,"unavailable")
 }finally{f.cleanup();outside.cleanup()}
})
test("visual breaker: per-image and shared image budgets are enforced across attachments",()=>{
 const f=fixture()
 try {
  const bytes=Buffer.concat([png,Buffer.alloc(512*1024-png.length)])
  const a=f.record("large.png",bytes),budget={remaining:2*1024*1024}
  for(let i=0;i<4;i++)assert.equal(attachmentEvidence(f.root,a,budget).status,"verified")
  assert.equal(budget.remaining,0)
  assert.equal(attachmentEvidence(f.root,a,budget).imageDataUrl,null)
  assert.equal(attachmentEvidence(f.root,f.record("too-large.png",Buffer.concat([bytes,Buffer.from([0])]))).imageDataUrl,null)
 }finally{f.cleanup()}
})
test("visual breaker: truncated image headers cannot be offered as valid previews",()=>{
 const f=fixture()
 try {
  for(const [path,bytes,type] of [["truncated.png",png.subarray(0,24),"image/png"],["truncated.jpg",Buffer.from([255,216,255,217]),"image/jpeg"]] as const){
   const projection=attachmentEvidence(f.root,f.record(path,bytes,type))
   assert.equal(projection.status,"unsupported",path)
   assert.equal(projection.imageDataUrl,null,path)
  }
 }finally{f.cleanup()}
})
// One out-of-intent case: exhausted image allowance must not hide independent textual findings.
test("visual breaker: exhausted image budget still preserves bounded text findings",()=>{
 const f=fixture()
 try {
  const a=f.record("findings.txt",Buffer.from("Measured result was inconclusive"),"text/plain")
  const p=attachmentEvidence(f.root,a,{remaining:0})
  assert.equal(p.text,"Measured result was inconclusive");assert.equal(p.imageDataUrl,null)
 }finally{f.cleanup()}
})


test("visual breaker: historical screenshots cannot exhaust the preview budget before required current screenshots",()=>{
 const root=mkdtempSync(join(tmpdir(),"sl-current-visual-break-")),ws="a61c3d8a-3c03-49ab-a230-bf4d3e876d30",slice="ca05b5cc-6a81-45cd-9c04-c3047e3f95f4",turn="1c5a8e44-dd09-543a-97d5-bfe173becbaa"
 try{
  initLedger(root,"current screenshot priority")
  writeJson(join(root,`.spec-ledger/workstreams/${ws}.json`),{schemaVersion:1,id:ws,status:"shaped",title:"Current images",featureIds:[],acceptanceCriteria:["Current images are visible"],policy:{requireSpecBreak:false,requireCodeBreak:false},trust:{visualEvidence:{[slice]:["Current desktop"]}},suggestedSlices:[{id:slice,title:"Visual",kind:"vertical",acceptance:["Works"]}]})
  sealWorkstream(root,ws,"fixture")
  writeJson(join(root,`.spec-ledger/turns/${turn}.json`),{id:turn,status:"closed",intent:{workstreamId:ws,sliceId:slice},openedAt:"2026-09-01T00:00:00Z"})
  const oldBytes=Buffer.concat([png,Buffer.alloc(512*1024-png.length)])
  writeFileSync(join(root,".spec-ledger/old.png"),oldBytes);writeFileSync(join(root,".spec-ledger/current.png"),png)
  const currentId="ffffffff-ffff-4fff-8fff-ffffffffffff",sourceDigest=computeTreeDigest(root),revisionDigest=planRevision(root,loadWorkstream(root,ws))
  const ids=Array.from({length:4},(_,i)=>`00000000-0000-4000-8000-00000000000${i}`)
  for(const id of [...ids,currentId]){
   const current=id===currentId,bytes=current?png:oldBytes
   writeJson(join(root,`.spec-ledger/attachments/${turn}/${id}.json`),{schemaVersion:1,id,turnId:turn,kind:"image",title:current?"Current desktop":"Earlier screenshot",path:current?".spec-ledger/current.png":".spec-ledger/old.png",mediaType:"image/png",contentDigest:contentHash(bytes),visualEvidence:{sliceId:slice,surface:"Current desktop",sourceDigest:current?sourceDigest:"0".repeat(64),revisionDigest,recordedAt:current?"2026-09-07T00:00:00Z":"2026-09-01T00:00:00Z"}})
  }
  const session=getSession(root,ws).session!
  assert.equal(session.visualEvidence.ok,true)
  assert.equal(session.visualEvidence.surfaces[0].attachmentId,currentId)
  const selected=session.artifacts.find(a=>a.id===currentId)!
  assert.equal(selected.status,"verified","the authoritative current screenshot must receive preview budget before historical gallery images")
  assert.ok(selected.imageDataUrl?.startsWith("data:image/png;base64,"))
  assert.equal(session.artifacts.length,5,"historical records remain inspectable")
  assert.ok(session.artifacts.some(a=>ids.includes(a.id)&&a.imageDataUrl===null),"budget remains bounded after current images are prioritized")
 }finally{rmSync(root,{recursive:true,force:true})}
})
