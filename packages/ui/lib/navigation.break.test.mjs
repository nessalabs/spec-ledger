import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const ts=createRequire(new URL('../../ledger/package.json',import.meta.url))('typescript')
const React=require('react')
function compile(path,overrides={}) {
 const output=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 const mod={exports:{}}
 new Function('require','module','exports',output)(id=>overrides[id]??require(id),mod,mod.exports)
 return mod.exports
}
const mapping=compile('./spec-sections.ts')
function nodes(node, predicate) {
 if(!node||typeof node!=='object')return []
 return [...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>nodes(child,predicate))]
}
test('section history returns from execution to exact acceptance without hiding the evidence',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document
 const listeners=new Map(),scrolled=[];let selected='evidence',effects=[]
 globalThis.window={location:{hash:'#execution-activity'},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{assert.equal(listeners.get(name),fn);listeners.delete(name)}}
 globalThis.document={getElementById:id=>({scrollIntoView:()=>scrolled.push(id)}),querySelector:()=>null}
 const component=compile('../components/spec-sections.tsx',{'@/lib/spec-sections':mapping,react:{...React,useState:()=>[selected,value=>{selected=value}],useEffect:fn=>effects.push(fn)}}).SpecSections
 const render=()=>{effects=[];return component({evidence:'real evidence',changes:'real history',process:'real process'})}
 try {
  render();const cleanup=effects[0]();effects[1]()
  let tree=render();assert.equal(nodes(tree,n=>n.props.id==='workflow')[0].props.hidden,false)
  globalThis.window.location.hash='#acceptance-886b091f-57f9-5f69-9e74-f0b50275d693%2FAC-1';listeners.get('hashchange')()
  tree=render();effects[1]()
  assert.equal(nodes(tree,n=>n.props.id==='evidence')[0].props.hidden,false)
  assert.equal(nodes(tree,n=>n.props.id==='workflow')[0].props.hidden,true)
  assert.equal(scrolled.at(-1),'acceptance-886b091f-57f9-5f69-9e74-f0b50275d693%2FAC-1')
  globalThis.window.location.hash='#changes';listeners.get('popstate')();tree=render()
  assert.equal(nodes(tree,n=>n.props.id==='changes')[0].props.hidden,false)
  assert.equal(nodes(tree,n=>n.type==='a'&&n.props['aria-current']==='location')[0].props.href,'#changes')
  globalThis.window.location.hash='';listeners.get('popstate')();tree=render()
  assert.equal(nodes(tree,n=>n.props.id==='evidence')[0].props.hidden,false)
  cleanup();assert.equal(listeners.size,0)
 } finally {globalThis.window=oldWindow;globalThis.document=oldDocument}
})
test('unknown or obsolete fragments do not strand readers in an invisible section',()=>{
 for(const hash of ['', '#unknown', '#acceptance-886b091f-57f9-5f69-9e74-f0b50275d693%2FAC-1', '#evidence'])assert.equal(mapping.specSectionForHash(hash),'evidence')
 for(const hash of ['#workflow','#execution-activity','#engineering-method','#agent-execution','#process'])assert.equal(mapping.specSectionForHash(hash),'process')
 assert.equal(mapping.specSectionForHash('#changes'),'changes')
})
test('mobile navigation closes on same-page selection and route change but preserves modified clicks',()=>{
 const oldWindow=globalThis.window;let mobile=true,open=true,effects=[],pathname='/workstreams'
 const updates=[]
 const setOpen=value=>{open=value;updates.push(value)}
 const ui=new Proxy({useSidebar:()=>({setOpen})},{get:(target,key)=>target[key]??((props)=>React.createElement('div',props,props.children))})
 const Link=props=>React.createElement('a',props,props.children)
 globalThis.window={matchMedia:()=>({matches:mobile,addEventListener(){},removeEventListener(){}})}
 const Shell=compile('../components/spec-ledger-shell.tsx',{'react':{...React,useState:()=>[open,setOpen],useEffect:fn=>effects.push(fn)},'next/link':{default:Link},'next/navigation':{usePathname:()=>pathname},'@nessalabs/ui':ui,'lucide-react':new Proxy({},{get:()=>()=>null}),'@/lib/cn':{cn:(...values)=>values.join(' ')},'@/components/doc-reader':{DocReaderProvider:({children})=>children},'@/components/theme-toggle':{ThemeToggle:()=>null}}).SpecLedgerShell
 const expand=node=>{
  if(!node||typeof node!=='object')return node
  if(typeof node.type==='function')return expand(node.type(node.props))
  return {...node,props:{...node.props,children:[node.props?.children].flat(Infinity).map(expand)}}
 }
 try {
  effects=[];expand(Shell({children:'page'}));effects.forEach(fn=>fn());assert.equal(open,false,'small screens begin with unobstructed content')
  open=true;effects=[];const tree=expand(Shell({children:'page'}))
  const link=nodes(tree,n=>n.type==='a'&&n.props.href==='/workstreams'&&n.props.onClick)[0]
  assert.ok(link,'real sidebar spec link is reachable')
  link.props.onClick({});assert.equal(open,false,'same-page link closes overlay even when pathname does not change')
  for(const key of ['metaKey','ctrlKey','shiftKey','altKey']){open=true;link.props.onClick({[key]:true});assert.equal(open,true,key)}
  open=true;pathname='/claims';effects=[];expand(Shell({children:'page'}));effects.at(-1)();assert.equal(open,false,'route changes dismiss mobile navigation')
  mobile=false;open=true;link.props.onClick({});assert.equal(open,true,'desktop navigation stays visible')
 } finally {globalThis.window=oldWindow}
})
test('change history is isolated from the live child list and renders without key warnings',()=>{
 const originalError=console.error,warnings=[]
 const initial={session:{workstreamId:'c6e720a0-1f36-5f81-926e-675e70c01b63',title:'History',criteria:[],evidenceCount:0,completion:{reasons:[]},activity:[{id:'a0c351bd-f316-5227-87ff-f3f5b7bb5edc',summary:'Update',reason:'Changed'}],executionActivity:{association:null}}}
 const Empty=()=>null
 const Live=compile('../components/live-workstream-evidence.tsx',{
  'next/link':{default:({children,href})=>React.createElement('a',{href},children)},
  '@/components/spec-sections':{SpecSections:({changes})=>changes},
  '@/components/acceptance-progress':{AcceptanceProgress:Empty},
  '@/components/workstream-evidence':{WorkstreamEvidence:Empty},
  '@/components/use-session-observation':{useSessionObservation:()=>({data:initial,state:'connected'})},
  '@/components/live-workflow':{LiveWorkflow:Empty},
  '@/components/workflow-view':{WorkflowDetails:Empty},
  '@/components/execution-activity':{ExecutionActivityDetails:Empty},
 }).LiveWorkstreamEvidence
 try {
  console.error=(...args)=>warnings.push(args.join(' '))
  const history=React.createElement('section',null,'Recorded history')
  const tree=Live({initial,workstreamId:'c6e720a0-1f36-5f81-926e-675e70c01b63',history})
  const holder=nodes(tree,n=>n.props?.changes)[0].props.changes
  assert.equal(holder.props.children[0].type,'div','server history has a stable wrapper in the sibling list')
  assert.equal(holder.props.children[0].props.children,history)
  const html=require('react-dom/server').renderToStaticMarkup(tree)
  assert.match(html,/Recorded history/);assert.match(html,/Update/)
  assert.equal(warnings.filter(w=>w.includes('unique')&&w.includes('key')).length,0)
 } finally { console.error=originalError }
})
test('the in-page workflow retains its picker and process state when live data changes workstream',()=>{
 const initial={session:{workstreamId:'ccb2b722-9ead-50bb-ab8d-35d4288f0731',status:'done',workflow:{profile:{title:'Chosen workflow'}},criteria:[],executionActivity:{association:null}}}
 const Live=compile('../components/live-workflow.tsx',{
  '@/components/use-session-observation':{useSessionObservation:()=>({data:{session:{workstreamId:'0f12d4b7-acb6-5536-96ff-70fa7138f541'}},state:'disconnected'})},
  '@/components/workflow-picker':{WorkflowPicker:({workstreamId})=>React.createElement('p',null,`Picker ${workstreamId}`)},
  '@/components/workflow-view':{WorkflowDetails:({workflow})=>React.createElement('p',null,workflow.profile.title)},
  '@/components/execution-activity':{ExecutionActivityDetails:()=>null},
 }).LiveWorkflow
 const html=require('react-dom/server').renderToStaticMarkup(React.createElement(Live,{initial,workstreamId:'ccb2b722-9ead-50bb-ab8d-35d4288f0731'}))
 for(const text of ['Picker ccb2b722-9ead-50bb-ab8d-35d4288f0731','Chosen workflow','Disconnected','current process requirements','No agent session'])assert.ok(html.includes(text),text)
})
test('a deleted library name stays visible with its preserved version while switching is pending',()=>{
 const workflow={profile:{id:'f5c81d07-74c5-59cc-82de-e67a653589b0',title:'Copied workflow',source:'library',profileDigest:'12345678abcdef',snapshotDigest:'snapshot'}}
 const library={entries:[],default:{profileId:null,digest:'default'}}
 let index=0;const seeded=[library,false,'spec-ledger/default','',undefined,false,'']
 const Picker=compile('../components/workflow-picker.tsx',{
  react:{...React,useState:initial=>[index<seeded.length?seeded[index++]:initial,()=>{}],useEffect:()=>{}},
  'next/link':{default:({children,href})=>React.createElement('a',{href},children)},
  '@nessalabs/ui':{Badge:({children})=>React.createElement('span',null,children),Button:({children,variant,...props})=>React.createElement('button',props,children)},
  '@/lib/workflow-api':{useWorkflowMutation:()=>({pending:{action:'apply'},busy:false,message:'Uncertain result'}),readWorkflows:()=>{throw Error('render must not request')},previewWorkflow:()=>{throw Error('render must not mutate')}},
 }).WorkflowPicker
 const tree=Picker({workstreamId:'a2eef8c7-6679-5552-85b5-71509b938486',workflow})
 const html=require('react-dom/server').renderToStaticMarkup(tree)
 for(const text of ['Copied workflow','Deleted from library','12345678','preserved copy','Retry pending selection'])assert.ok(html.includes(text),text)
 assert.equal(nodes(tree,n=>n.props.children==='Choose workflow')[0].props.disabled,true)
 assert.doesNotMatch(html,/Define a saved workflow/)
})

test('workflow definition has one library route and the old per-spec route no longer resolves',()=>{
 assert.equal(existsSync(new URL('../app/workflows/page.tsx',import.meta.url)),true)
 assert.equal(existsSync(new URL('../app/workflows/[id]/page.tsx',import.meta.url)),false)
 const page=readFileSync(new URL('../app/workflows/page.tsx',import.meta.url),'utf8')
 assert.match(page,/WorkflowLibrary/);assert.doesNotMatch(page,/LiveWorkflow|WorkflowPicker/)
 const live=readFileSync(new URL('../components/live-workflow.tsx',import.meta.url),'utf8')
 assert.match(live,/WorkflowPicker/);assert.doesNotMatch(live,/WorkflowEditor/)
})
