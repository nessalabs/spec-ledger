import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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
