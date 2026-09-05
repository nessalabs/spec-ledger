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
 const expected=Array.from({length:8},(_,i)=>{const id=`W-${String(i+1).padStart(3,'0')}`,ws=loadWorkstream(root,id);return{id,criteria:acceptanceItems(ws).map(c=>({...c,mappedClaimIds:ws.acceptanceClaimIds?.[c.id]??[]}))}})
 const report=JSON.parse(readFileSync(resolve(root,'docs/workstreams/W-009-evidence-first-changes/evidence/T-039/completed-workstreams-audit.json'),'utf8'))
 const errors=validateAudit(report,expected,path=>{if(typeof path!=='string'||isAbsolute(path))throw Error();const full=realpathSync(resolve(root,path)),rel=relative(realpathSync(root),full);if(rel.startsWith('..')||isAbsolute(rel)||!statSync(full).isFile())throw Error()})
 if(errors.length)throw new Error(errors.join('\n'))
 return `Audit inventory checked: ${expected.reduce((n,w)=>n+w.criteria.length,0)} criteria in 8 workstreams. Gaps remain explicitly recorded; this does not prove all historical features pass.`
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(checkRepository(process.cwd()))
