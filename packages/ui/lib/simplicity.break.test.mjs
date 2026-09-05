import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),React=require('react'),ts=createRequire(new URL('../../ledger/package.json',import.meta.url))('typescript')
function load(file,overrides={}){const m={exports:{}};const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','module','exports',code)(id=>overrides[id]??require(id),m,m.exports);return m.exports}
function text(node,visible=false){if(node==null||node===false)return '';if(Array.isArray(node))return node.map(n=>text(n,visible)).join(' ');if(typeof node!=='object')return String(node);if(typeof node.type==='function')return text(node.type(node.props),visible);if(visible&&node.type==='details'&&!node.props.open)return text([node.props.children].flat().filter(n=>n?.type==='summary'),visible);return text(node.props?.children,visible)}
function nodes(node,p){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(n=>nodes(n,p));return [...(p(node)?[node]:[]),...nodes(node.props?.children,p)]}
const Progress=load('../components/acceptance-progress.tsx',{'@/lib/acceptance-progress':load('./acceptance-progress.ts')}).AcceptanceProgress
const Evidence=load('../components/workstream-evidence.tsx',{'@/components/check-evidence':{CheckEvidencePanel:({label,bindingId})=>React.createElement('details',{'data-binding':bindingId},React.createElement('summary',null,label),React.createElement('p',null,'Inspect source and actual output'))},'next/link':{default:props=>React.createElement('a',props,props.children)},'@nessalabs/ui':{Badge:props=>React.createElement('span',null,props.children)},'@/lib/features':{presentationCopy:s=>s}}).WorkstreamEvidence

test('simpler progress keeps incomplete and historical limits visible even when all checks pass',()=>{
 const full=Progress({total:2,verified:2,implemented:0,remaining:['Code review still required']})
 assert.match(text(full,true),/2\s*\/\s*2\s+verified/);assert.match(text(full,true),/Still needed.*Code review still required/)
 assert.doesNotMatch(text(full,true),/agent reported/)
 assert.match(text(full),/Current implementation reports:\s*0\s*\/\s*2/)
 const old=Progress({total:2,verified:0,implemented:0,historical:true,unmapped:1,remaining:['Rerun the check']})
 for(const s of ['no linked checks','Completed earlier','Needs rechecking','Rerun the check'])assert.ok(text(old,true).includes(s),s)
 const empty=Progress({total:0,verified:0,implemented:0})
 assert.match(text(empty,true),/No acceptance criteria/)
 assert.equal(nodes(empty,n=>n.props?.role==='progressbar')[0].props['aria-valuenow'],undefined)
})

test('failed missing attested and unmapped requirements keep their limitations beside expandable proof',()=>{
 const criteria=['fail','missing','attested','missing'].map((evidence,i)=>({id:`AC-${i}`,text:`Behavior ${i}`,evidence,implemented:true,claims:i===3?[]:[{id:`C-${i}`,statement:'Expected behavior',checks:[{id:`B-${i}`,kind:'test',outcome:evidence,definition:{type:'command',command:'run-check'},recorded:[]}]}]}))
 const tree=Evidence({session:{criteria,reviews:[],artifacts:[]},observedAt:'now'})
 const visible=text(tree,true)
 for(const s of ['Failed','A check failed','Evidence needed','Current passing evidence is not available','Attested only','passing test evidence is still needed','No checks are mapped'])assert.ok(visible.includes(s),s)
 assert.doesNotMatch(visible,/Implementation recorded|run-check/)
 const proof=nodes(tree,n=>n.props?.bindingId)
 assert.equal(proof.length,3)
 assert.ok(proof.every(n=>n.props.label==='View proof'&&!n.props.defaultOpen))
 assert.equal((visible.match(/View proof/g)??[]).length,3)
 assert.match(text(tree),/Inspect source and actual output/)
 assert.match(text(tree),/A check definition is not a test run/)
 assert.equal(nodes(tree,n=>n.props?.href?.startsWith('/claims/')).length,3)
})

test('simplified feature observation still exposes disconnection without replacing the requested spec',()=>{
 const initial={session:{workstreamId:'W-one',title:'Feature',criteria:[],evidenceCount:0,completion:{reasons:[]},activity:[]}}
 const Empty=()=>null
 const Live=load('../components/live-workstream-evidence.tsx',{'next/link':{default:Empty},'@/components/spec-sections':{SpecSections:Empty},'@/components/acceptance-progress':{AcceptanceProgress:Empty},'@/components/workstream-evidence':{WorkstreamEvidence:Empty},'@/components/use-session-observation':{useSessionObservation:()=>({data:{session:{workstreamId:'W-other'}},state:'disconnected',observed:'old observation'})}}).LiveWorkstreamEvidence
 assert.match(text(Live({initial,workstreamId:'W-one'}),true),/disconnected.*last observation/)
})

test('opening proof reads evidence without posting a command',async()=>{
 const originalFetch=globalThis.fetch,effects=[],requests=[]
 const Panel=load('../components/check-evidence.tsx',{'react':{...React,useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect:fn=>effects.push(fn)},'next/navigation':{useRouter:()=>({refresh(){}})},'@nessalabs/ui':{Button:()=>null,Badge:()=>null,CodeBlock:()=>null,preloadCodeHighlighter:()=>Promise.resolve()}}).CheckEvidencePanel
 try{
  globalThis.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({runs:[]})}}
  Panel({bindingId:'B-example',defaultOpen:true,label:'View proof'})
  const cleanups=effects.map(fn=>fn())
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(requests.length,1)
  assert.equal(requests[0].url,'/api/checks?bindingId=B-example')
  assert.equal(requests[0].options.method,undefined)
  cleanups.forEach(fn=>fn?.())
 }finally{globalThis.fetch=originalFetch}
})
