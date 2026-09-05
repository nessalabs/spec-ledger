import {test} from 'node:test'
import assert from 'node:assert/strict'
import {validateAudit} from '../../../scripts/verify-completed-audit.mjs'
const expected=[{id:'W-001',criteria:[{id:'AC-1',text:'Works',mappedClaimIds:[]}]}]
const report=()=>({workstreams:[{id:'W-001',criteria:[{id:'AC-1',text:'Works',mappedClaimIds:[],assessment:'gap',rationale:'No behavioral proof yet',evidenceSources:['spec.md']}]}]})
test('a complete audit can acknowledge missing feature evidence',()=>assert.deepEqual(validateAudit(report(),expected,()=>{}),[]))
test('rejects missing, duplicate, rewritten and falsely mapped audit entries',()=>{
 for(const change of [r=>r.workstreams=[],r=>r.workstreams[0].criteria=[],r=>r.workstreams[0].criteria.push(r.workstreams[0].criteria[0]),r=>r.workstreams[0].criteria[0].text='Something easier',r=>r.workstreams[0].criteria[0].mappedClaimIds=['fake'],r=>r.workstreams[0].criteria[0].assessment='mapped']){const r=report();change(r);assert.ok(validateAudit(r,expected,()=>{}).length)}
})
test('requires explained judgments and readable evidence references',()=>{
 const r=report();r.workstreams[0].criteria[0].rationale='';assert.ok(validateAudit(r,expected,()=>{}).length)
 assert.ok(validateAudit(report(),expected,()=>{throw Error('missing')}).length)
})
