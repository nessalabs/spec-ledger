import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = createRequire(new URL('../../ledger/package.json', import.meta.url))('typescript')
function load(file, overrides) {
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true}}).outputText
  const module={exports:{}}
  new Function('require','module','exports',compiled)(id=>overrides[id]??require(id),module,module.exports)
  return module.exports
}
const Link=({children,href,...props})=>React.createElement('a',{href,...props},children)
const Box=({children})=>React.createElement('div',null,children)
const ui={Button:({asChild,children,...props})=>asChild?children:React.createElement('button',props,children),DropdownMenu:Box,DropdownMenuTrigger:Box,DropdownMenuContent:Box,DropdownMenuRadioGroup:Box,DropdownMenuRadioItem:Box}
function home(session,state='connected') {
 const initial={session,choices:[{id:session.workstreamId,title:session.title}]}
 const {LiveSession}=load('../components/live-session.tsx',{'react':React,'next/link':Link,'@nessalabs/ui':ui,'lucide-react':{ChevronDown:()=>null},'@/lib/turn-evidence':{completionLabel:()=>null},'@/lib/features':{presentationCopy:s=>s},'@/components/acceptance-progress':{AcceptanceProgress:props=>React.createElement('p',null,props.remaining.join('; '))},'@/components/use-session-observation':{useSessionObservation:()=>({data:initial,state,observed:null})}})
 return renderToStaticMarkup(React.createElement(LiveSession,{initial}))
}
const session={workstreamId:'W-011',title:'Readable work',goal:'See proof',revision:1,status:'active',permission:{allowed:false,reasons:[]},completion:{eligible:false,reasons:['Current review missing']},criteria:[],evidenceCount:0,attention:['A failing check needs attention'],activity:[1,2,3,4].map(n=>({id:String(n),summary:`Update ${n}`,reason:'Reason'})),preview:null}
test('overview keeps permission and problems visible with direct spec, evidence and history links',()=>{
 const html=home(session)
 for(const text of ['Approve this revision','Deny','A failing check needs attention','Current review missing','Read spec','View evidence']) assert.ok(html.includes(text),text)
 for(const href of ['/workstreams/W-011','/workstreams/W-011#evidence','/workstreams/W-011#changes','/workflows/W-011']) assert.ok(html.includes(href),href)
 assert.ok(!html.includes('Update 4'))
 assert.ok(!html.includes('No preview recorded'))
})
test('approved work does not request approval again and disconnected approval stays disabled',()=>{
 assert.ok(!home({...session,permission:{allowed:true,reasons:[]}}).includes('Approve this revision'))
 assert.match(home(session,'disconnected'),/<button disabled="">Approve this revision/)
})
