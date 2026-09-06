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
  f.mutation("finish_turn",{turnId:"T-001",action:"abandon",expectedRevisionDigest:undefined})
  assert.throws(()=>f.mutation("record_screenshot",{turnId:"T-001",surface:"Desktop",path}),/open/)
  assert.equal(existsSync(join(f.root,".spec-ledger/attachments/T-001")),false)
  f.mutation("begin_work",{workstreamId:"W-001",sliceId:"SLC-01",turnId:"T-002",goal:"Continue",expectedSourceDigest:undefined,allowDirty:true})
  recordAuthority(f.root,{action:"revoke",targetId:"AUTH-fixture",source:{kind:"agent-reported",reference:"Breaker revokes permission"}})
  assert.throws(()=>f.mutation("record_screenshot",{turnId:"T-002",surface:"Desktop",path}),/permission|authoriz/)
  assert.equal(existsSync(join(f.root,".spec-ledger/attachments/T-002")),false)
 }finally{f.cleanup()}
})
test("visual breaker: wrong turn, stale guards and invalid declarations fail closed",()=>{
 const f=visualFixture()
 try {
  const path=f.capture("current"),stale=f.guards()
  assert.equal(checkVisualEvidence(f.root,"W-001","T-999").ok,false)
  writeFileSync(join(f.root,"app.txt"),"Changed UI")
  assert.throws(()=>f.mutation("record_screenshot",{turnId:"T-001",surface:"Desktop",path,...stale}),/source/)
  assert.throws(()=>f.mutation("record_screenshot",{turnId:"T-001",surface:"Desktop",path,expectedRevisionDigest:"0".repeat(64)}),/revision/)
  assert.equal(checkVisualEvidence(f.root,"W-001").surfaces.filter(s=>s.satisfied).length,0)
  const ws=loadWorkstream(f.root,"W-001")
  for(const map of [{"SLC-01":[]},{"SLC-01":["Desktop","Desktop"]},{"SLC-999":["Desktop"]}])assert.throws(()=>visualRequirements({...ws,trust:{...ws.trust,visualEvidence:map}}),/Invalid/)
 }finally{f.cleanup()}
})
test("visual breaker: malformed images, remote files and escaping attachment paths never publish evidence",()=>{
 const f=visualFixture(),outside=visualFixture([])
 try {
  const path=f.capture("bad");writeFileSync(join(f.root,path),fixturePng.subarray(0,24))
  assert.throws(()=>f.mutation("record_screenshot",{turnId:"T-001",surface:"Desktop",path}),/valid PNG/)
  assert.throws(()=>f.mutation("record_screenshot",{turnId:"T-001",surface:"Desktop",path:"https://example.invalid/a.png"}))
  const external=outside.capture("outside")
  symlinkSync(join(outside.root,external),join(f.root,".spec-ledger/evidence/screenshots/escape.png"))
  assert.throws(()=>f.mutation("record_screenshot",{turnId:"T-001",surface:"Desktop",path:".spec-ledger/evidence/screenshots/escape.png"}),/escape/)
  const good=f.capture("valid")
  symlinkSync(outside.root,join(f.root,".spec-ledger/attachments"))
  assert.throws(()=>f.mutation("record_screenshot",{turnId:"T-001",surface:"Desktop",path:good}),/escape/)
  assert.equal(existsSync(join(outside.root,"T-001")),false)
 }finally{f.cleanup();outside.cleanup()}
})
test("visual breaker: completion cannot use missing screenshots or another turn's images to close",()=>{
 const f=visualFixture(["Desktop"])
 try {
  assert.throws(()=>f.mutation("complete_work",{workstreamId:"W-001"}),/screenshot|open turn/)
  f.mutation("record_screenshot",{turnId:"T-001",surface:"Desktop",path:f.capture("first")})
  f.mutation("finish_turn",{turnId:"T-001",action:"close",expectedRevisionDigest:undefined})
  f.mutation("begin_work",{workstreamId:"W-001",sliceId:"SLC-01",turnId:"T-002",goal:"Continue",expectedSourceDigest:undefined,allowDirty:true})
  assert.equal(checkVisualEvidence(f.root,"W-001").ok,true)
  assert.equal(checkVisualEvidence(f.root,"W-001","T-002").ok,false)
  assert.throws(()=>f.mutation("finish_turn",{turnId:"T-002",action:"close",expectedRevisionDigest:undefined}),/Attach screenshots/)
  assert.equal(loadLedger(f.root).turns.find(t=>t.id==="T-002")!.status,"open")
 }finally{f.cleanup()}
})
// One out-of-intent killer: alternate captures must be allocated globally, not greedily.
test("visual breaker: alternative screenshots satisfy distinct surfaces regardless of attachment order",()=>{
 const f=visualFixture()
 try {
  const a=f.capture("a"),b=f.capture("b","another view")
  f.mutation("record_screenshot",{requestId:"aaaaaaaaaaaaaaaa",turnId:"T-001",surface:"Desktop",path:a})
  f.mutation("record_screenshot",{requestId:"bbbbbbbbbbbbbbbb",turnId:"T-001",surface:"Desktop",path:b})
  f.mutation("record_screenshot",{requestId:"cccccccccccccccc",turnId:"T-001",surface:"Mobile",path:a})
  assert.equal(checkVisualEvidence(f.root,"W-001").ok,true,"Desktop can use B while Mobile uses A; unique valid coverage exists")
 }finally{f.cleanup()}
})
