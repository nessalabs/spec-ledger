import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
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
 globalThis.document={getElementById:id=>({scrollIntoView:()=>scrolled.push(id)})}
 const component=compile('../components/spec-sections.tsx',{'@/lib/spec-sections':mapping,react:{...React,useState:()=>[selected,value=>{selected=value}],useEffect:fn=>effects.push(fn)}}).SpecSections
 const render=()=>{effects=[];return component({evidence:'real evidence',changes:'real history',process:'real process'})}
 try {
  render();const cleanup=effects[0]();effects[1]()
  let tree=render();assert.equal(nodes(tree,n=>n.props.id==='process')[0].props.hidden,false)
  globalThis.window.location.hash='#acceptance-SLC-01%2FAC-1';listeners.get('hashchange')()
  tree=render();effects[1]()
  assert.equal(nodes(tree,n=>n.props.id==='evidence')[0].props.hidden,false)
  assert.equal(nodes(tree,n=>n.props.id==='process')[0].props.hidden,true)
  assert.equal(scrolled.at(-1),'acceptance-SLC-01%2FAC-1')
  globalThis.window.location.hash='#changes';listeners.get('popstate')();tree=render()
  assert.equal(nodes(tree,n=>n.props.id==='changes')[0].props.hidden,false)
  assert.equal(nodes(tree,n=>n.type==='a'&&n.props['aria-current']==='location')[0].props.href,'#changes')
  globalThis.window.location.hash='';listeners.get('popstate')();tree=render()
  assert.equal(nodes(tree,n=>n.props.id==='evidence')[0].props.hidden,false)
  cleanup();assert.equal(listeners.size,0)
 } finally {globalThis.window=oldWindow;globalThis.document=oldDocument}
})
test('unknown or obsolete fragments do not strand readers in an invisible section',()=>{
 for(const hash of ['', '#unknown', '#acceptance-SLC-01%2FAC-1', '#evidence'])assert.equal(mapping.specSectionForHash(hash),'evidence')
 for(const hash of ['#execution-activity','#engineering-method','#agent-execution','#process'])assert.equal(mapping.specSectionForHash(hash),'process')
 assert.equal(mapping.specSectionForHash('#changes'),'changes')
})
test('mobile navigation closes on same-page selection and route change but preserves modified clicks',()=>{
 const oldWindow=globalThis.window;let mobile=true,open=true,effects=[],pathname='/workstreams'
 const updates=[]
 const setOpen=value=>{open=value;updates.push(value)}
 const ui=new Proxy({useSidebar:()=>({setOpen})},{get:(target,key)=>target[key]??((props)=>React.createElement('div',props,props.children))})
 const Link=props=>React.createElement('a',props,props.children)
 globalThis.window={matchMedia:()=>({matches:mobile,addEventListener(){},removeEventListener(){}})}
 const Shell=compile('../components/spec-ledger-shell.tsx',{'react':{...React,useState:()=>[open,setOpen],useEffect:fn=>effects.push(fn)},'next/link':{default:Link},'next/navigation':{usePathname:()=>pathname},'@nessalabs/ui':ui,'lucide-react':new Proxy({},{get:()=>()=>null}),'@/lib/cn':{cn:(...values)=>values.join(' ')},'@/components/doc-reader':{DocReaderProvider:({children})=>children}}).SpecLedgerShell
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
  open=true;pathname='/verify';effects=[];expand(Shell({children:'page'}));effects.at(-1)();assert.equal(open,false,'route changes dismiss mobile navigation')
  mobile=false;open=true;link.props.onClick({});assert.equal(open,true,'desktop navigation stays visible')
 } finally {globalThis.window=oldWindow}
})
