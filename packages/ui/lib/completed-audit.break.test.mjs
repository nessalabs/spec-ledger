import {test} from 'node:test'
import assert from 'node:assert/strict'
import {validateAudit} from '../../../scripts/verify-completed-audit.mjs'
const expected=[{id:'W-001',criteria:[{id:'AC-1',text:'Original',mappedClaimIds:['C-1']},{id:'AC-2',text:'Remaining',mappedClaimIds:[]}]}]
const report=()=>({scope:{workstreamIds:['W-001'],criterionCount:2,mappedCriteria:1,gapCriteria:1,supersededCriteria:0},workstreams:[{id:'W-001',criteria:[{id:'AC-1',text:'Original',mappedClaimIds:['C-1'],assessment:'mapped',rationale:'Inspected mapped check',evidenceSources:['test.ts']},{id:'AC-2',text:'Remaining',mappedClaimIds:[],assessment:'gap',rationale:'No complete proof',evidenceSources:['spec.md']}]}]})
test('audit cannot relabel another workstream or erase a mapped requirement',()=>{for(const edit of[r=>r.workstreams[0].id='W-002',r=>r.workstreams[0].criteria[0].mappedClaimIds=[]]){const r=report();edit(r);assert.ok(validateAudit(r,expected,()=>{}).length)}})
test('audit summary counts and scope must agree with its inspected inventory',()=>{assert.deepEqual(validateAudit(report(),expected,()=>{}),[]);for(const edit of[r=>r.scope.criterionCount=99,r=>r.scope.gapCriteria=0,r=>r.scope.mappedCriteria=2,r=>r.scope.workstreamIds=['W-999']]){const r=report();edit(r);assert.ok(validateAudit(r,expected,()=>{}).length,'contradictory summary must fail')}})
