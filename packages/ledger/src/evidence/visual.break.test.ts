import { randomUUID } from "node:crypto"
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, writeFileSync, symlinkSync } from "node:fs"
import { join } from "node:path"
import { visualFixture, fixturePng } from "./visual.fixture.js"
import { checkVisualEvidence, visualRequirements } from "./visual.js"
import { recordAuthority } from "../permission/authority.js"
import { loadWorkstream } from "../workstream/load.js"
import { loadLedger } from "../fs/load.js"

test("visual breaker: closed turns and revoked permission cannot publish new screenshots",()=>{
 const f=visualFixture()
 try {
  const path=f.capture("current")
  f.mutation("finish_turn",{turnId:f.turnId,action:"abandon",expectedRevisionDigest:undefined})
  assert.throws(()=>f.mutation("record_screenshot",{turnId:f.turnId,surface:"Desktop",path}),/open/)
  assert.equal(existsSync(join(f.root,`.spec-ledger/attachments/${f.turnId}`)),false)
  const next=f.mutation("begin_work",{workstreamId:f.workstreamId,sliceId:f.sliceId,goal:"Continue",expectedSourceDigest:undefined,allowDirty:true}) as {id:string}
  recordAuthority(f.root,{action:"revoke",targetId:f.authorityId,source:{kind:"agent-reported",reference:"Breaker revokes permission"}})
  assert.throws(()=>f.mutation("record_screenshot",{turnId:next.id,surface:"Desktop",path}),/permission|authoriz/)
  assert.equal(existsSync(join(f.root,`.spec-ledger/attachments/${next.id}`)),false)
 }finally{f.cleanup()}
})
test("visual breaker: wrong turn, stale guards and invalid declarations fail closed",()=>{
 const f=visualFixture()
 try {
  const path=f.capture("current"),stale=f.guards()
  assert.equal(checkVisualEvidence(f.root,f.workstreamId,randomUUID()).ok,false)
  writeFileSync(join(f.root,"app.txt"),"Changed UI")
  assert.throws(()=>f.mutation("record_screenshot",{turnId:f.turnId,surface:"Desktop",path,...stale}),/source/)
  assert.throws(()=>f.mutation("record_screenshot",{turnId:f.turnId,surface:"Desktop",path,expectedRevisionDigest:"0".repeat(64)}),/revision/)
  assert.equal(checkVisualEvidence(f.root,f.workstreamId).surfaces.filter(s=>s.satisfied).length,0)
  const ws=loadWorkstream(f.root,f.workstreamId)
  for(const map of [{[f.sliceId]:[]},{[f.sliceId]:["Desktop","Desktop"]},{[randomUUID()]:["Desktop"]}])assert.throws(()=>visualRequirements({...ws,trust:{...ws.trust,visualEvidence:map}}),/Invalid/)
 }finally{f.cleanup()}
})
test("visual breaker: malformed images, remote files and escaping attachment paths never publish evidence",()=>{
 const f=visualFixture(),outside=visualFixture([])
 try {
  const path=f.capture("bad");writeFileSync(join(f.root,path),fixturePng.subarray(0,24))
  assert.throws(()=>f.mutation("record_screenshot",{turnId:f.turnId,surface:"Desktop",path}),/valid PNG/)
  assert.throws(()=>f.mutation("record_screenshot",{turnId:f.turnId,surface:"Desktop",path:"https://example.invalid/a.png"}))
  const external=outside.capture("outside")
  symlinkSync(join(outside.root,external),join(f.root,".spec-ledger/evidence/screenshots/escape.png"))
  assert.throws(()=>f.mutation("record_screenshot",{turnId:f.turnId,surface:"Desktop",path:".spec-ledger/evidence/screenshots/escape.png"}),/escape/)
  const good=f.capture("valid")
  symlinkSync(outside.root,join(f.root,".spec-ledger/attachments"))
  assert.throws(()=>f.mutation("record_screenshot",{turnId:f.turnId,surface:"Desktop",path:good}),/escape/)
  assert.equal(existsSync(join(outside.root,f.turnId)),false)
 }finally{f.cleanup();outside.cleanup()}
})
test("visual breaker: completion cannot use missing screenshots or another turn's images to close",()=>{
 const f=visualFixture(["Desktop"])
 try {
  assert.throws(()=>f.mutation("complete_work",{workstreamId:f.workstreamId}),/screenshot|open turn/)
  f.mutation("record_screenshot",{turnId:f.turnId,surface:"Desktop",path:f.capture("first")})
  f.mutation("finish_turn",{turnId:f.turnId,action:"close",expectedRevisionDigest:undefined})
  const next=f.mutation("begin_work",{workstreamId:f.workstreamId,sliceId:f.sliceId,goal:"Continue",expectedSourceDigest:undefined,allowDirty:true}) as {id:string}
  assert.equal(checkVisualEvidence(f.root,f.workstreamId).ok,true)
  assert.equal(checkVisualEvidence(f.root,f.workstreamId,next.id).ok,false)
  assert.throws(()=>f.mutation("finish_turn",{turnId:next.id,action:"close",expectedRevisionDigest:undefined}),/Attach screenshots/)
  assert.equal(loadLedger(f.root).turns.find(t=>t.id===next.id)!.status,"open")
 }finally{f.cleanup()}
})
// One out-of-intent killer: alternate captures must be allocated globally, not greedily.
test("visual breaker: alternative screenshots satisfy distinct surfaces regardless of attachment order",()=>{
 const f=visualFixture()
 try {
  const a=f.capture("a"),b=f.capture("b","another view")
  f.mutation("record_screenshot",{requestId:"aaaaaaaaaaaaaaaa",turnId:f.turnId,surface:"Desktop",path:a})
  f.mutation("record_screenshot",{requestId:"bbbbbbbbbbbbbbbb",turnId:f.turnId,surface:"Desktop",path:b})
  f.mutation("record_screenshot",{requestId:"cccccccccccccccc",turnId:f.turnId,surface:"Mobile",path:a})
  assert.equal(checkVisualEvidence(f.root,f.workstreamId).ok,true,"Desktop can use B while Mobile uses A; unique valid coverage exists")
 }finally{f.cleanup()}
})
