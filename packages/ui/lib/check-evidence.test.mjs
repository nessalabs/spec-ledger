import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const ts=createRequire(new URL('../../ledger/package.json',import.meta.url))('typescript')
const React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const compiled=ts.transpileModule(readFileSync(new URL('../components/check-evidence.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
function component(run=null){
 let states=0
 const overrides={react:{...React,useState:initial=>[states++===2?run:initial,()=>{}]},'next/navigation':{useRouter:()=>({refresh(){throw new Error('Rendering must not refresh')}})},'@nessalabs/ui':{CodeBlock:({code,filename,language})=>React.createElement('pre',{'data-filename':filename,'data-language':language},code),Button:({children,...props})=>React.createElement('button',props,children),Badge:({children})=>React.createElement('span',null,children)}}
 const module={exports:{}}
 new Function('require','module','exports',compiled)(id=>overrides[id]??require(id),module,module.exports)
 return module.exports.CheckEvidencePanel
}
const evidence={bindingId:'test',claimId:'SL-001',kind:'test',command:'node example.cjs',cwd:'/fixture',sourceDigest:'source',checkDigest:'check',currentOutcome:'missing',source:{status:'not-recorded',path:null,text:null,sha256:null},runs:[]}
test('passive evidence render keeps authored expectations distinct and escapes test source',()=>{
 const html=renderToStaticMarkup(React.createElement(component(),{bindingId:'test',initial:{...evidence,test:{level:'unit',description:'Adds numbers',inputs:'[2,3]',expected:'5'},source:{status:'available',path:'example.cjs',text:'assert.equal(actual, "<script>bad()</script>")',sha256:'hash'}},defaultOpen:true}))
 assert.match(html,/Input \/ setup · recorded description/)
 assert.match(html,/Expected behavior · recorded description/)
 assert.match(html,/No detailed run output was captured/)
 assert.ok(!html.includes('<script>bad()'))
 assert.match(html,/Run again/)
 assert.match(html,/Directory:.*\/fixture/)
})
test('actual failures and tampered logs remain visible independently of a described expectation',()=>{
 const run={runId:'run',state:'finished',outcome:'fail',startedAt:'2026-09-04',exitCode:1,durationMs:20,sourceDigest:'old',checkDigest:'check',cwd:'/fixture',command:'node example.cjs',stdout:{status:'intact',text:'actual: 4',truncated:true,sha256:'hash'},stderr:{status:'unavailable',text:'FORGED PASS',truncated:false,sha256:'bad'}}
 const html=renderToStaticMarkup(React.createElement(component(run),{bindingId:'test',initial:evidence,defaultOpen:true}))
 assert.match(html,/Actual run result.*finished/)
 assert.match(html,/fail.*exit 1/)
 assert.match(html,/actual: 4/)
 assert.match(html,/truncated/)
 assert.ok(!html.includes('FORGED PASS'))
 assert.match(html,/integrity could not be verified/)
 assert.match(html,/Test level not recorded/)
})
test('uncertain HTTP response reconnects with the same request identity', async()=>{
 const values=[], refs=[];let index=0,refIndex=0
 const hooks={...React,useState:initial=>{const i=index++;if(!(i in values))values[i]=initial;return[values[i],value=>values[i]=value]},useRef:initial=>refs[refIndex++]??(refs[refIndex-1]={current:initial}),useEffect:()=>{}}
 const module={exports:{}}
 new Function('require','module','exports',compiled)(id=>id==='react'?hooks:id==='next/navigation'?{useRouter:()=>({refresh(){}})}:id==='@nessalabs/ui'?{Button:'button',Badge:'span',CodeBlock:'pre'}:require(id),module,module.exports)
 const render=()=>{index=0;refIndex=0;return module.exports.CheckEvidencePanel({bindingId:'test',initial:evidence,defaultOpen:true})}
 function button(node){if(!node||typeof node!=='object')return null;if(node.type==='button'&&node.props.variant!=='outline')return node;for(const child of [node.props?.children].flat(Infinity)){const found=button(child);if(found)return found}return null}
 const original=globalThis.fetch;const requests=[]
 globalThis.fetch=async(url,options)=>{
  if(options?.method==='POST'){requests.push(JSON.parse(options.body));return{ok:false,status:409,json:async()=>({code:'execution_unknown',error:'Accepted request has an unknown outcome'})}}
  return{ok:true,json:async()=>({token:'token'})}
 }
 try{
  button(render()).props.onClick()
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(button(render()).props.children,'Reconnect to request')
  button(render()).props.onClick()
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(requests.length,2)
  assert.deepEqual(requests[0],requests[1])
 }finally{globalThis.fetch=original}
})
