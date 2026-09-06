import {randomUUID} from 'node:crypto'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),React=require('react'),ts=createRequire(new URL('../../ledger/package.json',import.meta.url))('typescript')
function load(file,overrides={}){const m={exports:{}};const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','module','exports',code)(id=>overrides[id]??(id==='@/components/task-updates'?load('../components/task-updates.tsx',overrides):id==='@/components/readable-text'?load('../components/readable-text.tsx'):id==='@/lib/record-labels'?load('./record-labels.ts'):require(id)),m,m.exports);return m.exports}
function text(node,visible=false){if(node==null||node===false)return '';if(Array.isArray(node))return node.map(n=>text(n,visible)).join(' ');if(typeof node!=='object')return String(node);if(typeof node.type==='function'&&node.type.name==='ReadableText')return require('react-dom/server').renderToStaticMarkup(node);if(typeof node.type==='function')return text(node.type(node.props),visible);if(visible&&node.type==='details'&&!node.props.open)return text([node.props.children].flat().filter(n=>n?.type==='summary'),visible);return text(node.props?.children,visible)}
function nodes(node,p){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(n=>nodes(n,p));return [...(p(node)?[node]:[]),...nodes(node.props?.children,p)]}
const Progress=load('../components/acceptance-progress.tsx',{'@/lib/acceptance-progress':load('./acceptance-progress.ts')}).AcceptanceProgress
const Evidence=load('../components/workstream-evidence.tsx',{'@/components/evidence-card':{EvidenceCard:({id,heading,children,defaultOpen})=>React.createElement('details',{id,open:defaultOpen},React.createElement('summary',null,heading),children)},'@/components/visual-evidence':{VisualEvidence:()=>null},'@/components/check-evidence':{CheckEvidencePanel:({label,bindingId})=>React.createElement('details',{'data-binding':bindingId},React.createElement('summary',null,label),React.createElement('p',null,'Inspect source and actual output'))},'next/link':{default:props=>React.createElement('a',props,props.children)},'@nessalabs/ui':{Badge:props=>React.createElement('span',null,props.children)},'@/lib/features':{presentationCopy:s=>s}}).WorkstreamEvidence

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

test('failed missing attested and unmapped requirements keep honest statuses on expandable requirements',()=>{
 const criteria=['fail','missing','attested','missing'].map((evidence,i)=>({id:`AC-${i}`,text:`Behavior ${i}`,evidence,implemented:true,claims:i===3?[]:[{id:randomUUID(),statement:'Expected behavior',checks:[{id:randomUUID(),kind:'test',outcome:evidence,definition:{type:'command',command:'run-check'},recorded:[]}]}]}))
 const tree=Evidence({session:{criteria,reviews:[],artifacts:[]},observedAt:'now'})
 const visible=text(tree,true)
 for(const s of ['Failed','Evidence needed','Attested only'])assert.ok(visible.includes(s),s)
 const expanded=text(Evidence({session:{criteria,reviews:[],artifacts:[]},observedAt:'now',expandChecks:true}),true)
 for(const s of ['A check failed','Current passing evidence is not available','passing test evidence is still needed','No checks are mapped'])assert.ok(expanded.includes(s),s)
 assert.doesNotMatch(visible,/Implementation recorded|run-check/)
 const proof=nodes(tree,n=>n.props?.bindingId)
 assert.equal(proof.length,3)
 assert.ok(proof.every(n=>n.props.label==='Test results'&&n.props.defaultOpen&&n.props.embedded))
 assert.doesNotMatch(visible,/View proof|Test results/)
 assert.equal(nodes(tree,n=>n.props?.id?.startsWith('acceptance-')).length,4)
 assert.match(text(tree),/Inspect source and actual output/)
 assert.match(text(tree),/A check definition is not a test run/)
 assert.equal(nodes(tree,n=>n.props?.href?.startsWith('/claims/')).length,3)
})

test('simplified feature observation still exposes disconnection without replacing the requested spec',()=>{
 const initial={session:{workstreamId:'1b97ba60-2cb1-5cb1-9e50-895290ac231f',title:'Feature',criteria:[],evidenceCount:0,completion:{reasons:[]},activity:[]}}
 const Empty=()=>null
 const Live=load('../components/live-workstream-evidence.tsx',{'next/link':{default:Empty},'@/components/live-workflow':{LiveWorkflow:Empty},'@/components/spec-sections':{SpecSections:Empty},'@/components/acceptance-progress':{AcceptanceProgress:Empty},'@/components/workstream-evidence':{WorkstreamEvidence:Empty},'@/components/use-session-observation':{useSessionObservation:()=>({data:{session:{workstreamId:'0f12d4b7-acb6-5536-96ff-70fa7138f541'}},state:'disconnected',observed:'old observation'})}}).LiveWorkstreamEvidence
 assert.match(text(Live({initial,workstreamId:'1b97ba60-2cb1-5cb1-9e50-895290ac231f'}),true),/disconnected.*last observation/)
})

test('opening proof reads evidence without posting a command',async()=>{
 const originalFetch=globalThis.fetch,effects=[],requests=[]
 const Panel=load('../components/check-evidence.tsx',{'react':{...React,useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect:fn=>effects.push(fn)},'next/navigation':{useRouter:()=>({refresh(){}})},'@nessalabs/ui':{Button:()=>null,Badge:()=>null,CodeBlock:()=>null,preloadCodeHighlighter:()=>Promise.resolve()}}).CheckEvidencePanel
 try{
  globalThis.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({runs:[]})}}
  Panel({bindingId:'f37a7568-5eff-5d83-b6f8-714ff9384d50',defaultOpen:true,label:'View proof'})
  const cleanups=effects.map(fn=>fn())
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(requests.length,1)
  assert.equal(requests[0].url,'/api/checks?bindingId=f37a7568-5eff-5d83-b6f8-714ff9384d50')
  assert.equal(requests[0].options.method,undefined)
  cleanups.forEach(fn=>fn?.())
 }finally{globalThis.fetch=originalFetch}
})

test('requirement expansion mounts proof only on demand and screenshot labels never imply current pass',()=>{
 let opened=false
 const Card=load('../components/evidence-card.tsx',{'react':{useState:initial=>[initial,value=>{opened=value}]}}).EvidenceCard
 const lazy=Card({id:'AC-1',heading:'Evidence needed',children:React.createElement('p',null,'EVIDENCE BODY')})
 assert.doesNotMatch(text(lazy),/EVIDENCE BODY/)
 lazy.props.onToggle({currentTarget:{open:true}})
 assert.equal(opened,true)
 const expanded=Card({id:'AC-1',heading:'Evidence needed',defaultOpen:true,children:React.createElement('p',null,'EVIDENCE BODY')})
 assert.match(text(expanded),/EVIDENCE BODY/)
 const Visual=load('../components/visual-evidence.tsx',{'react':{useRef:()=>({current:null}),useState:v=>[v,()=>{}]}}).VisualEvidence
 let screenshot
 require('react-dom/server').renderToStaticMarkup(React.createElement(function CaptureVisual(){screenshot=Visual({src:'data:image/png;base64,fixture',title:'Historical demo',note:'Captured on an earlier revision'});return screenshot}))
 assert.match(text(screenshot),/Saved visual observation/)
 assert.match(text(screenshot),/Captured on an earlier revision/)
 assert.doesNotMatch(text(screenshot),/Current passing|Verified requirement/)
 assert.equal(nodes(screenshot,n=>n.type==='dialog').length,1)
 assert.equal(nodes(screenshot,n=>n.type==='button'&&n.props['aria-label']==='Enlarge Historical demo').length,1)
})

test('passing run metadata stays collapsed while output failures and historical warnings remain visible',()=>{
 const evidence={bindingId:'a56b72e7-48a0-5cd6-b5c2-20eb12257138',command:'saved-command',cwd:'/fixture',sourceDigest:'current',checkDigest:'check',currentOutcome:'pass',source:{status:'not-recorded'},test:{level:'integration',description:'Verifies behavior'},runs:[]}
 const base={runId:'run',state:'finished',outcome:'pass',reason:'Command exited successfully',startedAt:'2026-09-06',finishedAt:'2026-09-06',exitCode:0,sourceDigest:'current',checkDigest:'check',command:'saved-command',stdout:{status:'intact',text:'Meaningful test output'},stderr:{status:'intact',text:''}}
 const render=run=>{let index=0;const Panel=load('../components/check-evidence.tsx',{'react':{...React,useState:v=>[index++===2?run:v,()=>{}],useRef:v=>({current:v}),useEffect:()=>{}},'next/navigation':{useRouter:()=>({refresh(){}})},'@nessalabs/ui':{Button:props=>React.createElement('button',props,props.children),Badge:props=>React.createElement('span',props,props.children),CodeBlock:()=>null}}).CheckEvidencePanel;return Panel({bindingId:'a56b72e7-48a0-5cd6-b5c2-20eb12257138',initial:evidence,defaultOpen:true,embedded:true})}
 const passing=render(base),visible=text(passing,true)
 assert.match(visible,/Meaningful test output/)
 assert.doesNotMatch(visible,/Current evidence: pass|Command exited successfully|Actual run result|finished|exit 0|Started/)
 assert.match(text(passing),/finished/)
 const failure=text(render({...base,outcome:'fail',exitCode:1,reason:'Assertion failed',sourceDigest:'old'}),true)
 assert.match(failure,/Historical run/)
 assert.match(failure,/Actual run result/)
 assert.match(failure,/fail.*exit 1/)
 assert.match(failure,/Assertion failed/)
 const missing=text(render({...base,stdout:{status:'unavailable',text:'FORGED'},sourceDigest:'old'}),true)
 assert.match(missing,/Historical run/)
 assert.match(missing,/integrity could not be verified/)
 assert.doesNotMatch(missing,/FORGED/)
})

test('completion keeps finished planning ahead of implementation and never changes supplied states or counts',()=>{
 const checklist=[{id:'turn',label:'Close turn',state:'not-started'},{id:'criteria',label:'Build criteria',state:'in-progress'},{id:'spec-review',label:'Review plan',state:'done'},{id:'seal',label:'Preserve plan',state:'done'},{id:'code-review',label:'Review code',state:'not-started'},{id:'workflow',label:'Complete workflow',state:'not-started'}]
 const original=structuredClone(checklist)
 const tree=Progress({total:17,verified:3,implemented:4,checklist})
 const rows=nodes(tree,n=>n.type==='li')
 assert.deepEqual(rows.map(n=>text(n).replace(/\s+/g,' ').trim()),['Preserve plan','Review plan','Build criteria','Review code','Complete workflow','Close turn'])
 assert.deepEqual(checklist,original)
 assert.match(text(tree),/3\s*\/\s*17\s+verified/)
 assert.deepEqual(rows.map(n=>nodes(n,x=>x.props?.state)[0].props.state),['done','done','in-progress','not-started','not-started','not-started'])
})
