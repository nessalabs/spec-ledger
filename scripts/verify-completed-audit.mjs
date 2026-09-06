import {readFileSync,realpathSync,statSync} from 'node:fs'
import {resolve,relative,isAbsolute} from 'node:path'
import {pathToFileURL} from 'node:url'
import {acceptanceItems,loadWorkstream} from '../packages/ledger/dist/index.js'
export function validateAudit(report, expected, inspectSource) {
 const errors=[]
 const rows=report?.workstreams
 if(!Array.isArray(rows))return ['Missing workstream inventory']
 if(rows.length!==expected.length || new Set(rows.map(x=>x.id)).size!==rows.length)errors.push('Workstream inventory is incomplete or duplicated')
 for(const ws of expected){
  const found=rows.find(x=>x.id===ws.id)
  if(!found||!Array.isArray(found.criteria)){errors.push(`${ws.id}: missing criteria`);continue}
  if(found.criteria.length!==ws.criteria.length || new Set(found.criteria.map(x=>x.id)).size!==found.criteria.length)errors.push(`${ws.id}: criteria incomplete or duplicated`)
  for(const item of ws.criteria){
   const row=found.criteria.find(x=>x.id===item.id)
   if(!row){errors.push(`${ws.id}/${item.id}: absent`);continue}
   if(row.text!==item.text)errors.push(`${ws.id}/${item.id}: acceptance changed`)
   if(JSON.stringify(row.mappedClaimIds)!==JSON.stringify(item.mappedClaimIds))errors.push(`${ws.id}/${item.id}: mapping changed`)
   if(!['mapped','gap','superseded'].includes(row.assessment)||typeof row.rationale!=='string'||!row.rationale.trim())errors.push(`${ws.id}/${item.id}: missing judgment`)
   if(row.assessment==='mapped'&&!item.mappedClaimIds.length)errors.push(`${ws.id}/${item.id}: unsupported mapped claim`)
   if(!Array.isArray(row.evidenceSources)||!row.evidenceSources.length)errors.push(`${ws.id}/${item.id}: no inspected sources`)
   else for(const path of row.evidenceSources){try{inspectSource(path)}catch{errors.push(`${ws.id}/${item.id}: unavailable source ${path}`)}}
  }
 }
 if(report.scope){
  const items=rows.flatMap(w=>Array.isArray(w.criteria)?w.criteria:[])
  const totals={criterionCount:items.length,mappedCriteria:items.filter(c=>c.assessment==='mapped').length,gapCriteria:items.filter(c=>c.assessment==='gap').length,supersededCriteria:items.filter(c=>c.assessment==='superseded').length}
  if(JSON.stringify(report.scope.workstreamIds)!==JSON.stringify(expected.map(w=>w.id)))errors.push('Reported workstream scope differs from inventory')
  for(const [key,value] of Object.entries(totals))if(report.scope[key]!==value)errors.push(`Reported ${key} differs from inventory`)
 }
 return errors
}
export function checkRepository(root){
 const expected=['3317ada5-b347-894e-8c88-110b7b42d58b','e6213c3f-60e4-8ceb-9d6a-15c67833b383','beee03a2-1e8d-8091-9ed9-b35bea93d6a3','76451749-a54f-8579-96f2-dcec19d79026','d1be55a6-11bb-8460-8650-ddf0ecac8185','a32f3451-1b3d-8abf-bf0e-607ebf6e1a88','1652e353-e3dc-8960-985b-35fbe40c1edb','815c7a44-59df-8102-9769-bf8a74e49c0c'].map(id=>{const ws=loadWorkstream(root,id);return{id,criteria:acceptanceItems(ws).map(c=>({...c,mappedClaimIds:ws.acceptanceClaimIds?.[c.id]??[]}))}})
 const report=JSON.parse(readFileSync(resolve(root,'docs/workstreams/3ca37660-1506-8a85-80c6-410a024d9a9a-evidence-first-changes/evidence/9fa55cfe-6dd6-83c5-8b42-baf619c093c6/completed-workstreams-audit.json'),'utf8'))
 const errors=validateAudit(report,expected,path=>{if(typeof path!=='string'||isAbsolute(path))throw Error();const full=realpathSync(resolve(root,path)),rel=relative(realpathSync(root),full);if(rel.startsWith('..')||isAbsolute(rel)||!statSync(full).isFile())throw Error()})
 if(errors.length)throw new Error(errors.join('\n'))
 return `Audit inventory checked: ${expected.reduce((n,w)=>n+w.criteria.length,0)} criteria in 8 workstreams. Gaps remain explicitly recorded; this does not prove all historical features pass.`
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(checkRepository(process.cwd()))
