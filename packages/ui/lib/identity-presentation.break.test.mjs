import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {dirname,resolve,extname} from 'node:path'
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const ts=createRequire(new URL('../../ledger/package.json',import.meta.url))('typescript')
const uuid=/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
const a='12f1d531-468a-4832-a1ef-2aafbfef818d',b='47c8cb70-07cb-47e5-a75c-0f142da6e83e',turnId='69cecd87-4d35-4131-8427-092986c91e93'
function harness(){
 const cache=new Map(),opened=[]
 const Link=({children,...props})=>React.createElement('a',props,children)
 const primitives=new Proxy({CodeBlock:({code})=>React.createElement('pre',null,code)},{get:(target,name)=>target[name]??(({children,variant,asChild,...props})=>React.createElement(name==='Button'?'button':'span',props,children))})
 const overrides={'next/link':{default:Link},'next/navigation':{useRouter:()=>({refresh(){}})},'@nessalabs/ui':primitives,'@/components/doc-reader':{useDocPane:()=>({openDoc:value=>opened.push(value)})}}
 function load(file){
  let path=resolve(dirname(fileURLToPath(import.meta.url)),file)
  if(!extname(path))path=['.ts','.tsx','.mjs'].map(x=>path+x).find(existsSync)??path
  if(cache.has(path))return cache.get(path).exports
  const mod={exports:{}};cache.set(path,mod)
  const output=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  new Function('require','module','exports',output)(id=>overrides[id]??(id.startsWith('@/')?load('../'+id.slice(2)):id.startsWith('.')?load(resolve(dirname(path),id)):require(id)),mod,mod.exports)
  return mod.exports
 }
 const render=(Component,props,labels={})=>{const {RecordLabelsProvider}=load('../components/readable-text.tsx');return renderToStaticMarkup(React.createElement(RecordLabelsProvider,{labels},React.createElement(Component,props)))}
 return {load,render,opened}
}
function displayed(html){return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ')}
function assertHuman(html){assert.doesNotMatch(displayed(html),uuid);for(const [,attribute]of html.matchAll(/(?:title|aria-label|alt)="([^"]*)"/g))assert.doesNotMatch(attribute,uuid)}
function assertTarget(html,path){assert.ok(html.includes(`href="${path}"`),`Exact navigation target preserved: ${path}`)}

test('identity presentation breaker: duplicate titled specs keep separate targets without UUID prose or tooltips',()=>{
 const h=harness(),{WorkstreamsList}=h.load('../components/workstreams-list.tsx')
 const workstreams=[a,b].map(id=>({id,title:'Keep the same title',objective:`Inspect related work ${a}`,problem:'Preserve both records',status:'draft',createdAt:'2026-09-06'})),original=structuredClone(workstreams)
 const labels=h.load('./record-labels.ts').buildRecordLabels({workstreams,claims:[],turns:[]})
 const html=h.render(WorkstreamsList,{rows:workstreams.map(workstream=>({workstream,progress:null,latestFixup:null})),view:'active',counts:{active:2,all:2,completed:0,cancelled:0},page:1,pages:1,observedAt:'2026-09-06T12:00:00Z'},labels)
 assertHuman(html);assert.match(displayed(html),/Inspect related work Keep the same title/);assert.equal((html.match(/href="\/workstreams\//g)??[]).length,2)
 for(const id of [a,b])assertTarget(html,`/workstreams/${id}`)
 assert.deepEqual(workstreams,original)
})

test('identity presentation breaker: requirement labels and document tooltips hide identities but retain distinct claim routes',()=>{
 const h=harness(),{ClaimsList}=h.load('../components/claims-list.tsx')
 const claims=[a,b].map(id=>({id,statement:'The same requirement',kind:'spec',required:true,links:{docs:[`docs/workstreams/${id}/spec.md`]}})),original=structuredClone(claims)
 const labels=h.load('./record-labels.ts').buildRecordLabels({workstreams:[],claims,turns:[]})
 const html=h.render(ClaimsList,{claims,bindings:[],verdicts:[]},labels)
 assertHuman(html);assert.match(displayed(html),/The same requirement/);assert.equal((html.match(/<a /g)??[]).length,2)
 for(const id of [a,b])assertTarget(html,`/claims/${id}`)
 assert.deepEqual(claims,original)
})

test('identity presentation breaker: missing work titles use an honest fallback while change routes stay exact',()=>{
 const h=harness(),{CompactTurnRow}=h.load('../components/compact-turn-row.tsx')
 const turn={id:turnId,status:'open',openedAt:'2026-09-06T12:00:00Z',intent:{workstreamId:a,restatedGoal:`Inspect work ${a}`}},original=structuredClone(turn)
 const html=h.render(CompactTurnRow,{turn,report:null,workstreamTitle:null})
 assertHuman(html);const missingLabel=html.match(new RegExp(`<a[^>]*href="/workstreams/${a}"[^>]*>([\\s\\S]*?)</a>`))?.[1];assert.ok(missingLabel);assert.match(displayed(missingLabel),/unavailable|unknown|untitled|referenced|related|spec|work/i)
 assertTarget(html,`/workstreams/${a}`);assertTarget(html,`/turns/${turnId}`)
 assert.deepEqual(turn,original)
})

test('identity presentation breaker: generated peek prose hides IDs while markdown destinations preserve identity',()=>{
 const h=harness(),peek=h.load('../components/peek-link.tsx')
 const cases=[
  [peek.workstreamPeekMarkdown({id:a,title:'A named spec',objective:`Continue ${b}`,status:'draft'}),`/workstreams/${a}`],
  [peek.claimPeekMarkdown({id:b,statement:'A named requirement',kind:'spec',required:true,bindings:0,detail:`Missing evidence for ${b}`}),`/claims/${b}`],
  [peek.turnPeekMarkdown({id:turnId,goal:'Inspect the result',workstreamId:a,workstreamTitle:'A named spec',status:'open'}),`/turns/${turnId}`],
 ]
 for(const [markdown,target]of cases){assert.doesNotMatch(markdown.replace(/\]\([^)]*\)/g,']'),uuid);assert.ok(markdown.includes(`](${target})`))}
})


test('identity presentation breaker: raw check source and command bytes survive label presentation',()=>{
 const h=harness(),{CheckEvidencePanel}=h.load('../components/check-evidence.tsx')
 const code=`const persistedIdentity = "${a}";`,command=`printf '${b}'`
 const evidence={bindingId:a,command,cwd:'/fixture',sourceDigest:'source',checkDigest:'check',currentOutcome:'pass',source:{status:'available',path:'fixture.txt',text:code},test:{description:'Inspect unchanged source'},runs:[]},original=structuredClone(evidence)
 const html=h.render(CheckEvidencePanel,{bindingId:a,initial:evidence,defaultOpen:true},{[a]:'Named check',[b]:'Named result'})
 assert.ok(html.includes(renderToStaticMarkup(React.createElement('pre',null,code))))
 assert.ok(html.includes(renderToStaticMarkup(React.createElement('pre',null,command))))
 assert.deepEqual(evidence,original)
})

test('identity presentation breaker: prose conversion retains code blocks and exact markdown destinations',()=>{
 const {readableMarkdown,readableText}=harness().load('./record-labels.ts')
 const source=`Related ${a} and ${b}.\n[Read the spec](/workstreams/${a})\n\n\`\`\`json\n{"id":"${b}"}\n\`\`\``
 const labels={[a]:'A known spec'},result=readableMarkdown(source,labels)
 assert.match(result,/A known spec/);assert.ok(result.includes(`](/workstreams/${a})`))
 assert.ok(result.includes(`\`\`\`json\n{"id":"${b}"}\n\`\`\``))
 const prose=result.replace(/\`\`\`[\s\S]*?\`\`\`/g,'').replace(/\]\([^)]*\)/g,']')
 assert.doesNotMatch(prose,uuid);assert.match(readableText(b,labels),/related|unavailable|unknown|record/i)
 assert.equal(source.includes(a),true)
})
