import assert from "node:assert/strict"
import {test} from "node:test"
import {randomUUID} from "node:crypto"
import {optimizationFixture} from "../optimization/optimization.fixture.js"
import {executeOperation, type OperationName} from "../application/operations.js"
import {loadLedger} from "../fs/load.js"
import {isEntityId} from "./index.js"

test("creation operations generate catalog identities, preserve retries and validate references",()=>{
  const f=optimizationFixture()
  try {
    const cases:Array<[OperationName,string,Record<string,unknown>,Record<string,unknown>]>=[
      ["create_tenet","tenet",{statement:"Preserve evidence",origin:"user"},{}],
      ["create_theme","theme",{title:"Improve reliability",summary:"Keep history dependable"},{}],
      ["record_learning","learning",{statement:"Show titles",source:{kind:"user-reported",reference:"Fixture request"}},{}],
      ["create_proposed_claim","claim",{kind:"spec",statement:"A proposed behavior",required:true},{workstreamId:f.workstreamId}],
      ["create_claim","claim",{kind:"spec",statement:"An authorized behavior",required:true},{turnId:f.turnId}],
    ]
    const ids=new Set<string>()
    for(const [operation,key,value,scope] of cases){
      const input={requestId:randomUUID(),...scope,[key]:value}
      const created=executeOperation(f.root,operation,input) as {id:string}
      assert.ok(isEntityId(created.id));assert.ok(!ids.has(created.id));ids.add(created.id)
      assert.deepEqual(executeOperation(f.root,operation,input),created)
      assert.throws(()=>executeOperation(f.root,operation,{...input,requestId:randomUUID(),[key]:{...value,id:randomUUID()}}),/invalid operation input/)
    }
    const claim=loadLedger(f.root).claims[0]!
    const binding=executeOperation(f.root,"create_binding",{requestId:randomUUID(),turnId:f.turnId,binding:{claimId:claim.id,kind:"check",locator:{type:"path",path:"system.ts"}}}) as {id:string}
    assert.ok(isEntityId(binding.id));assert.equal(loadLedger(f.root).bindings[0]?.claimId,claim.id)
    assert.throws(()=>executeOperation(f.root,"create_binding",{requestId:randomUUID(),turnId:f.turnId,binding:{claimId:randomUUID(),kind:"check",locator:{type:"path",path:"system.ts"}}}),/existing claim/)
    assert.throws(()=>executeOperation(f.root,"record_permission",{requestId:randomUUID(),authority:{id:randomUUID(),action:"grant",mode:"request",workstreamId:f.workstreamId,source:{kind:"agent-reported",reference:"fixture"}}}),/omit id/)
  }finally{f.cleanup()}
})
