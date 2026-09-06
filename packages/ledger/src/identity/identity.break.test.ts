import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawn, spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { initLedger } from "../cli/init.js"
import { executeOperation } from "../application/operations.js"
import { isEntityId, publishEntity } from "./index.js"
import { writeAlignWaiver } from "../align/waiver.js"

const workstream = { title: "Improve the same feature", problem: "Concurrent work must stay distinct", objective: "No overwritten identity", featureIds: ["fixture"], suggestedSlices: [{ title: "The same slice title", kind: "vertical", acceptance: ["Persist independently"], evidence: ["unit"] }] }
function fixture() {
 const root=mkdtempSync(join(tmpdir(),"sl-identity-break-"))
 const git=(...args:string[])=>{const p=spawnSync("git",args,{cwd:root,encoding:"utf8"});assert.equal(p.status,0,p.stderr)}
 git("init","-q");git("config","user.name","Identity fixture");git("config","user.email","fixture@example.test")
 initLedger(root,"Identity breaker")
 const path=join(root,".spec-ledger/graph/codebase-graph.json"),graph=JSON.parse(readFileSync(path,"utf8"))
 graph.features=[{id:"fixture",name:"Fixture"}];writeFileSync(path,JSON.stringify(graph))
 git("add",".");git("commit","-qm","Initial fixture")
 return {root,cleanup:()=>rmSync(root,{recursive:true,force:true})}
}
const create=(root:string,input:object)=>executeOperation(root,"create_workstream",input) as {id:string;title:string;suggestedSlices:Array<{id:string}>}
function concurrentCreate(root:string) {
 const moduleUrl=new URL("../application/operations.js",import.meta.url).href
 const script=`import {executeOperation} from ${JSON.stringify(moduleUrl)};import {randomUUID} from 'node:crypto'; const records=[];for(let i=0;i<8;i++)records.push(executeOperation(process.argv[1],'create_workstream',{requestId:randomUUID(),workstream:JSON.parse(process.argv[2])}));console.log(JSON.stringify(records));`
 return new Promise<Array<{id:string;title:string;suggestedSlices:Array<{id:string}>}>>((resolve,reject)=>{
  const p=spawn(process.execPath,["--input-type=module","-e",script,root,JSON.stringify(workstream)],{stdio:["ignore","pipe","pipe"]});let output="",error=""
  p.stdout.on("data",data=>{output+=data});p.stderr.on("data",data=>{error+=data});p.on("error",reject);p.on("close",code=>{if(code!==0)reject(new Error(error||`child exit ${code}`));else try{resolve(JSON.parse(output))}catch(e){reject(e)}})
 })
}
test("identity breaker: simultaneous independent checkouts never collide despite identical workstream and slice titles",async()=>{
 const a=fixture(),b=fixture()
 try {
  const groups=await Promise.all([concurrentCreate(a.root),concurrentCreate(b.root)])
  const records=groups.flat(),ids=records.flatMap(r=>[r.id,...r.suggestedSlices.map(s=>s.id)])
  assert.equal(records.length,16);assert.equal(new Set(ids).size,32);assert.ok(ids.every(isEntityId))
  for(const [index,f]of [a,b].entries()){
   assert.equal(readdirSync(join(f.root,".spec-ledger/workstreams")).filter(p=>p.endsWith(".json")).length,8)
   for(const record of groups[index]!)assert.deepEqual(JSON.parse(readFileSync(join(f.root,`.spec-ledger/workstreams/${record.id}.json`),"utf8")),record)
  }
 }finally{a.cleanup();b.cleanup()}
})
test("identity breaker: identical request retry returns the original entity while new correlation creates another",()=>{
 const f=fixture()
 try {
  const input={requestId:randomUUID(),workstream},first=create(f.root,input)
  const path=join(f.root,`.spec-ledger/workstreams/${first.id}.json`),before=readFileSync(path,"utf8")
  assert.deepEqual(create(f.root,input),first)
  assert.equal(readFileSync(path,"utf8"),before)
  assert.throws(()=>create(f.root,{...input,workstream:{...workstream,title:"Changed payload"}}),/request|different|conflict/)
  assert.notEqual(create(f.root,{requestId:randomUUID(),workstream}).id,first.id)
  assert.equal(readdirSync(join(f.root,".spec-ledger/workstreams")).length,2)
 }finally{f.cleanup()}
})
test("identity breaker: callers cannot inject numbered IDs or chosen UUIDs at either creation level",()=>{
 const f=fixture()
 try {
  for(const id of ["W-001",randomUUID()]){
   assert.throws(()=>create(f.root,{requestId:randomUUID(),workstream:{...workstream,id}}),/invalid operation input/)
   assert.throws(()=>create(f.root,{requestId:randomUUID(),workstream:{...workstream,suggestedSlices:[{...workstream.suggestedSlices[0],id}]}}),/invalid operation input/)
  }
  assert.equal(readdirSync(join(f.root,".spec-ledger/workstreams")).length,0)
  assert.throws(()=>create(f.root,{requestId:randomUUID(),workstream:{...workstream,featureIds:["absent"]}}),/feature/)
  assert.equal(readdirSync(join(f.root,".spec-ledger/workstreams")).length,0)
 }finally{f.cleanup()}
})
test("identity breaker: forced publication collision preserves complete original bytes and removes staging files",()=>{
 const f=fixture()
 try {
  const id=randomUUID(),path=join(f.root,`.spec-ledger/workstreams/${id}.json`)
  publishEntity(path,{id,...{title:"Original"}})
  const before=readFileSync(path,"utf8")
  assert.throws(()=>publishEntity(path,{id,...{title:"Replacement"}}),/EEXIST/)
  assert.equal(readFileSync(path,"utf8"),before)
  assert.equal(JSON.parse(before).title,"Original")
  assert.deepEqual(readdirSync(join(f.root,".spec-ledger/workstreams")),[`${id}.json`])
  assert.throws(()=>publishEntity(join(f.root,"old.json"),{id:"W-001"}),/UUID/)
 }finally{f.cleanup()}
})
test("identity breaker: waiver creation collision cannot overwrite the earlier coverage exception",()=>{
 const f=fixture()
 try {
  const id=randomUUID(),input={id,actor:"agent:fixture",reason:"Explicitly preserve this original coverage exception for the fixture",treeDigest:"a".repeat(64)}
  writeAlignWaiver(f.root,input)
  const path=join(f.root,`.spec-ledger/align-waivers/${id}.json`),before=readFileSync(path,"utf8")
  assert.throws(()=>writeAlignWaiver(f.root,{...input,reason:"A different coverage exception must not overwrite its predecessor"}),/exist|collision/i)
  assert.equal(readFileSync(path,"utf8"),before)
 }finally{f.cleanup()}
})
