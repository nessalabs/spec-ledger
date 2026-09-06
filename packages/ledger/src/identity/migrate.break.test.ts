import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, symlinkSync } from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { initLedger } from "../cli/init.js"
import { stageIdentityMigration, publishIdentityMigration } from "./migrate.js"
import { isEntityId } from "./index.js"
import { sha256Stable } from "../fs/load.js"

// Legacy IDs here are deliberate migration INPUT; live readers must never accept them.
function fixture() {
 const root=mkdtempSync(join(tmpdir(),"sl-migrate-break-")),stage=mkdtempSync(join(tmpdir(),"sl-migrate-stage-"))
 const git=(...args:string[])=>execFileSync("git",args,{cwd:root,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim()
 const write=(path:string,value:unknown)=>{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),typeof value==="string"?value:JSON.stringify(value,null,2)+"\n")}
 const commit=(message:string)=>{git("add",".");git("commit","-qm",message);return git("rev-parse","HEAD")}
 git("init","-q");git("config","user.name","Migration fixture");git("config","user.email","fixture@example.test");initLedger(root,"Migration fixture")
 write("docs/readme.md","Legacy W-001 and SL-001 are linked.\n")
 write(".spec-ledger/claims/SL-001.json",{id:"SL-001",statement:"Common requirement",required:true})
 write(".spec-ledger/bindings/B-001.json",{id:"B-001",claimId:"SL-001",kind:"test",locator:{type:"results-row",resultsKey:"common"}})
 write(".spec-ledger/workstreams/W-001.json",{schemaVersion:1,id:"W-001",title:"Common work",status:"shaped",featureIds:[],suggestedSlices:[{id:"SLC-01",title:"Common slice",kind:"vertical",acceptance:["Common behavior"]}],acceptanceClaimIds:{"SLC-01/AC-1":["SL-001"]}})
 const common=JSON.parse(readFileSync(join(root,".spec-ledger/workstreams/W-001.json"),"utf8"))
 const snapshotPath="workstreams/W-001.seals/1.json",specDigest=sha256Stable(common)
 write(".spec-ledger/"+snapshotPath,{schemaVersion:1,workstreamId:"W-001",revision:1,specDigest,body:common})
 write(".spec-ledger/workstreams/W-001.json",{...common,seal:{revision:1,snapshotPath,specDigest}})
 write(".spec-ledger/turns/T-001.json",{schemaVersion:1,id:"T-001",status:"closed",openedAt:"2026-01-01T00:00:00.000Z",intent:{workstreamId:"W-001",sliceId:"SLC-01"}})
 write(".spec-ledger/results/last.json",{schemaVersion:1,producedAt:"2026-01-01T00:00:00.000Z",producer:{name:"old-run",version:"1"},rows:[{key:"common",outcome:"pass",sourceDigest:"c".repeat(64),checkDigest:"d".repeat(64)}]})
 const base=commit("common ancestor")
 const add=(label:string)=>{
  write(".spec-ledger/claims/SL-002.json",{id:"SL-002",statement:label+" requirement",required:true})
  write(".spec-ledger/bindings/B-002.json",{id:"B-002",claimId:"SL-002",kind:"test",locator:{type:"results-row",resultsKey:label}})
  write(".spec-ledger/workstreams/W-002.json",{schemaVersion:1,id:"W-002",title:label+" work",status:"shaped",featureIds:[],suggestedSlices:[{id:"SLC-01",title:label+" slice",kind:"vertical",acceptance:[label+" behavior"]}],acceptanceClaimIds:{"SLC-01/AC-1":["SL-002"]}})
  write(".spec-ledger/turns/T-002.json",{schemaVersion:1,id:"T-002",status:"closed",openedAt:"2026-01-02T00:00:00.000Z",intent:{workstreamId:"W-002",sliceId:"SLC-01"}})
 }
 git("checkout","-qb","ours");add("ours");const ours=commit("ours independent records")
 git("checkout","-qb","theirs",base);add("theirs");const theirs=commit("theirs independent records")
 git("checkout","ours")
 const options={root,stage,base,ours,theirs}
 return {root,stage,git,write,commit,options,cleanup:()=>{rmSync(root,{recursive:true,force:true});rmSync(stage,{recursive:true,force:true})}}
}
function records(stage:string,collection:string):any[] {return readdirSync(join(stage,"output/.spec-ledger",collection)).filter(p=>p.endsWith(".json")).map(p=>JSON.parse(readFileSync(join(stage,"output/.spec-ledger",collection,p),"utf8")))}

test("migration breaker: independent same-number records retain distinct joins and common ancestry retains one identity",()=>{
 const f=fixture()
 try {
  stageIdentityMigration(f.options)
  const workstreams=records(f.stage,"workstreams"),turns=records(f.stage,"turns"),claims=records(f.stage,"claims"),bindings=records(f.stage,"bindings")
  assert.equal(workstreams.length,3);assert.equal(turns.length,3);assert.equal(claims.length,3);assert.equal(bindings.length,3)
  assert.equal(new Set([...workstreams,...turns,...claims,...bindings].map(v=>v.id)).size,12)
  assert.ok([...workstreams,...turns,...claims,...bindings].every(v=>isEntityId(v.id)))
  const common=workstreams.find(w=>w.title==="Common work")
  const snapshot=JSON.parse(readFileSync(join(f.stage,"output/.spec-ledger",common.seal.snapshotPath),"utf8"))
  assert.equal(snapshot.workstreamId,common.id)
  assert.equal(snapshot.body.id,common.id)
  assert.equal(snapshot.body.suggestedSlices[0].id,common.suggestedSlices[0].id)
  assert.equal(snapshot.specDigest,sha256Stable(snapshot.body))
  assert.equal(common.seal.specDigest,snapshot.specDigest)
  for(const label of ["ours","theirs"]){
   const ws=workstreams.find(w=>w.title===label+" work"),claim=claims.find(c=>c.statement===label+" requirement"),binding=bindings.find(b=>b.locator.resultsKey===label)
   assert.equal(binding.claimId,claim.id)
   assert.deepEqual(ws.acceptanceClaimIds[`${ws.suggestedSlices[0].id}/AC-1`],[claim.id])
   assert.equal(turns.find(t=>t.intent.workstreamId===ws.id).intent.sliceId,ws.suggestedSlices[0].id)
  }
  const manifest=JSON.parse(readFileSync(join(f.stage,"manifest.json"),"utf8"))
  const origin=manifest.origins.find((o:any)=>o.label==="ours"),entity=origin.entities.find((e:any)=>e.oldId==="W-002")
  const original=f.git("show",`${origin.commit}:${entity.path}`)+"\n"
  assert.equal(entity.sha256,createHash("sha256").update(original).digest("hex"))
  const results=JSON.parse(readFileSync(join(f.stage,"output/.spec-ledger/results/last.json"),"utf8"))
  assert.equal(results.rows[0].sourceDigest,"c".repeat(64));assert.equal(results.rows[0].outcome,"pass")
  const ready=readFileSync(join(f.stage,"ready.json"),"utf8")
  stageIdentityMigration(f.options);assert.equal(readFileSync(join(f.stage,"ready.json"),"utf8"),ready)
  publishIdentityMigration(f.root,f.stage)
  publishIdentityMigration(f.root,f.stage)
  const current=join(f.root,`.spec-ledger/workstreams/${workstreams[0].id}.json`)
  writeFileSync(current,readFileSync(current,"utf8")+" ")
  assert.throws(()=>publishIdentityMigration(f.root,f.stage),/changed after migration/)
 }finally{f.cleanup()}
})
test("migration breaker: conflicting ancestor edits require reconciliation before any live replacement",()=>{
 const f=fixture()
 try {
  const path=".spec-ledger/claims/SL-001.json"
  f.write(path,{id:"SL-001",statement:"Ours conflicts",required:true});const ours=f.commit("edit common ours")
  f.git("checkout","theirs");f.write(path,{id:"SL-001",statement:"Theirs conflicts",required:true});const theirs=f.commit("edit common theirs")
  const before=readFileSync(join(f.root,path),"utf8")
  assert.throws(()=>stageIdentityMigration({...f.options,ours,theirs}),/reconciliation/)
  assert.equal(readFileSync(join(f.root,path),"utf8"),before)
  assert.throws(()=>publishIdentityMigration(f.root,f.stage),/validate/)
 }finally{f.cleanup()}
})
test("migration breaker: dangling authority targets cannot pass staged reference validation",()=>{
 const f=fixture()
 try {
  f.write(".spec-ledger/authority/A-001.json",{schemaVersion:1,id:"A-001",action:"revoke",targetId:"A-999",source:{kind:"agent-reported",reference:"fixture"},createdAt:"2026-01-01T00:00:00.000Z"})
  const ours=f.commit("dangling authority target")
  assert.throws(()=>stageIdentityMigration({...f.options,ours}),/dangling|reference|target|legacy/i)
 }finally{f.cleanup()}
})
test("migration breaker: nested audit rows map criterion IDs in their own workstream context",()=>{
 const f=fixture()
 try {
  const commonPath=".spec-ledger/workstreams/W-001.json"
  const common=JSON.parse(readFileSync(join(f.root,commonPath),"utf8"))
  f.write(commonPath,{...common,specPath:"docs/common/spec.md"})
  f.write("docs/common/spec.md","Common work owns this document directory.\n")
  f.write("docs/common/audit.json",{workstreams:[{id:"W-001",criteria:[{id:"SLC-01/AC-1"}]},{id:"W-002",criteria:[{id:"SLC-01/AC-1"}]}]})
  const ours=f.commit("record nested audit contexts")
  stageIdentityMigration({...f.options,ours})
  const audit=JSON.parse(readFileSync(join(f.stage,"output/docs/common/audit.json"),"utf8"))
  const workstreams=records(f.stage,"workstreams")
  for(const row of audit.workstreams){
   const ws=workstreams.find(w=>w.id===row.id)
   assert.ok(ws)
   assert.equal(row.criteria[0].id,`${ws.suggestedSlices[0].id}/AC-1`)
  }
 }finally{f.cleanup()}
})
test("migration breaker: reconciliations require matching original values and preserve an attributed audit trail",()=>{
 const f=fixture()
 try {
  stageIdentityMigration(f.options)
  const common=records(f.stage,"workstreams").find(w=>w.title==="Common work")
  const path=`.spec-ledger/workstreams/${common.id}.json`
  const repair={path,pointer:["title"],before:"Common work",after:"Reconciled common work",reason:"Explicit fixture reconciliation"}
  stageIdentityMigration({...f.options,reconciliations:[repair]})
  const manifest=JSON.parse(readFileSync(join(f.stage,"manifest.json"),"utf8"))
  assert.deepEqual(manifest.reconciliations,[repair])
  assert.equal(records(f.stage,"workstreams").find(w=>w.id===common.id).title,repair.after)
  assert.deepEqual(records(f.stage,"workstreams").find(w=>w.id===common.id).migration,common.migration)
  const before=readFileSync(join(f.stage,"manifest.json"),"utf8")
  assert.throws(()=>stageIdentityMigration({...f.options,reconciliations:[{...repair,before:"Wrong origin"}]}),/precondition/)
  assert.equal(readFileSync(join(f.stage,"manifest.json"),"utf8"),before)
  assert.throws(()=>stageIdentityMigration({...f.options,reconciliations:[{...repair,pointer:["__proto__","polluted"]}]}),/safe pointer/)
  assert.throws(()=>stageIdentityMigration({...f.options,reconciliations:[{...repair,reason:" "}]}),/reason/)
 }finally{f.cleanup()}
})
test("migration breaker: extra staged files after validation cannot enter the live ledger",()=>{
 const f=fixture()
 try {
  stageIdentityMigration(f.options)
  const original=readFileSync(join(f.root,".spec-ledger/ledger.json"),"utf8")
  writeFileSync(join(f.stage,"output/.spec-ledger/unreviewed.json"),'{"injected":true}\n')
  assert.throws(()=>publishIdentityMigration(f.root,f.stage),/changed|unexpected|inventory|staged/i)
  assert.equal(readFileSync(join(f.root,".spec-ledger/ledger.json"),"utf8"),original)
 }finally{f.cleanup()}
})
test("migration breaker: a redirected pending publication directory cannot write outside the checkout",()=>{
 const f=fixture(),outside=mkdtempSync(join(tmpdir(),"sl-migrate-outside-"))
 try {
  stageIdentityMigration(f.options)
  symlinkSync(outside,join(f.root,".spec-ledger-migration-pending"))
  assert.throws(()=>publishIdentityMigration(f.root,f.stage),/symlink|symbolic link|unsafe|escape|directory/i)
  assert.deepEqual(readdirSync(outside),[])
 }finally{f.cleanup();rmSync(outside,{recursive:true,force:true})}
})
test("migration breaker: stale pending files cannot be published as part of a validated migration",()=>{
 const f=fixture()
 try {
  stageIdentityMigration(f.options)
  const pending=join(f.root,".spec-ledger-migration-pending")
  mkdirSync(pending)
  writeFileSync(join(pending,"unreviewed.json"),'{"injected":true}\n')
  try {publishIdentityMigration(f.root,f.stage)} catch(error) {assert.match(String(error),/pending|unexpected|inventory|staged|changed/i)}
  assert.equal(readdirSync(join(f.root,".spec-ledger")).includes("unreviewed.json"),false)
 }finally{f.cleanup()}
})
// One out-of-intent killer: a branch ref advancing between attempts cannot change frozen origin attribution.
test("migration breaker: retry uses frozen origin commits when the caller supplied moving branch names",()=>{
 const f=fixture()
 try {
  const options={...f.options,ours:"ours",theirs:"theirs"}
  stageIdentityMigration(options)
  const original=readFileSync(join(f.stage,"manifest.json"),"utf8")
  f.write("docs/later.md","New source after staging\n");f.commit("advance branch after staging")
  try {stageIdentityMigration(options)} catch(error){assert.match(String(error),/changed|frozen|origin|input|commit/)}
  assert.equal(readFileSync(join(f.stage,"manifest.json"),"utf8"),original)
 }finally{f.cleanup()}
})
