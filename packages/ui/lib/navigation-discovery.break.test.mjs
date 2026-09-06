import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {dirname,resolve,extname} from 'node:path'
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const ts=createRequire(new URL('../../ledger/package.json',import.meta.url))('typescript')
const a='12f1d531-468a-4832-a1ef-2aafbfef818d',b='47c8cb70-07cb-47e5-a75c-0f142da6e83e'
function harness(extra={}){
 const cache=new Map()
 const Link=({children,...props})=>React.createElement('a',props,children)
 const overrides={'next/link':{default:Link},'next/navigation':{useRouter:()=>({refresh(){}})},'@/components/doc-reader':{useDocPane:()=>({openDoc(){}})},...extra}
 function load(file){
  let path=resolve(dirname(fileURLToPath(import.meta.url)),file)
  if(!extname(path))path=['.ts','.tsx','.mjs'].map(x=>path+x).find(existsSync)??path
  if(cache.has(path))return cache.get(path).exports
  const m={exports:{}};cache.set(path,m)
  const output=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  new Function('require','module','exports',output)(id=>overrides[id]??(id.startsWith('@/')?load('../'+id.slice(2)):id.startsWith('.')?load(resolve(dirname(path),id)):require(id)),m,m.exports)
  return m.exports
 }
 const render=element=>renderToStaticMarkup(React.createElement(load('../components/readable-text.tsx').RecordLabelsProvider,{labels:{}},element))
 return {load,render}
}
const statuses=['draft','shaped','spec_review','sealed','active','done','cancelled']
const specs=statuses.map((status,i)=>({id:`spec-${i}`,title:i%2?'Fix progress':'Ordinary work',status,updatedAt:'2026-09-06T12:00:00Z'}))
const turn=(id,owner,changeType='fix',status='closed',at='2026-09-06T12:00:00Z')=>({id,status,openedAt:at,closedAt:status==='closed'?at:undefined,intent:{workstreamId:owner,changeType,restatedGoal:changeType==='fix'?'Adjust the behavior':'Fix the headline'}})
const projection=(workstreamId,eligible=false)=>({session:{workstreamId,criteria:[{implemented:true,evidence:'pass'}],completion:{eligible,checklist:[{id:'criteria',state:'done',done:1,total:1}, {id:'turn',state:eligible?'done':'todo'}]}}})
function nodes(node,p){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(n=>nodes(n,p));return [...(p(node)?[node]:[]),...nodes(node.props?.children,p)]}

test('discovery breaker: every workflow status partitions into the same active overview count and URL views',async()=>{
 const h=harness({'@/lib/ledger':{serverClient:()=>({getSession:async()=>({session:null}),listWorkstreams:async()=>specs,getTurns:async()=>[],getClaims:async()=>[]}),liveReport:async()=>({claims:[]})},'@/components/live-session':{LiveSession:()=>null}})
 const lib=h.load('./workstream-list.ts'),counts=lib.specViewCounts(specs)
 assert.deepEqual(counts,{active:5,all:7,completed:1,cancelled:1})
 for(const view of ['active','all','completed','cancelled'])assert.equal(lib.specListPage(specs,[],view).total,counts[view])
 assert.deepEqual(lib.specListPage(specs,[],'active').workstreams.map(w=>w.status).sort(),statuses.slice(0,5).sort())
 assert.equal(lib.specView(), 'active');assert.equal(lib.specView('bogus'),'active')
 const html=h.render(await h.load('../app/page.tsx').default({searchParams:Promise.resolve({})}))
 assert.match(html,/href="\/workstreams\?view=active"/);assert.match(html,/5 active · 7 total/)
})

test('discovery breaker: pagination is bounded deterministic and invalid values cannot drop the selected view',()=>{
 const lib=harness().load('./workstream-list.ts'),many=Array.from({length:45},(_,i)=>({id:`spec-${String(i).padStart(2,'0')}`,title:'Same title',status:'active'})),original=structuredClone(many)
 const first=lib.specListPage(many,[],'all','1'),second=lib.specListPage(many,[],'all','2'),last=lib.specListPage(many,[],'all','999')
 assert.equal(first.workstreams.length,20);assert.equal(second.workstreams.length,20);assert.equal(last.workstreams.length,5);assert.equal(last.page,3)
 assert.equal(new Set([...first.workstreams,...second.workstreams,...last.workstreams].map(w=>w.id)).size,45)
 for(const value of ['0','-2','1.5','NaN','Infinity','junk'])assert.deepEqual(lib.specListPage(many,[],'all',value),first)
 assert.deepEqual(lib.specListPage([],[],'active'),{workstreams:[],page:1,pages:1,total:0});assert.deepEqual(many,original)
})

test('discovery breaker: actual server page observes only selected rows and isolates failed or mismatched sessions',async()=>{
 const calls=[],many=Array.from({length:43},(_,i)=>({id:`spec-${String(i).padStart(2,'0')}`,title:'Same title',status:'active'}))
 const h=harness({'@/lib/ledger':{serverClient:()=>({listWorkstreams:async()=>many,getTurns:async()=>[],getSession:async id=>{calls.push(id);if(id==='spec-20')throw new Error('offline');return projection(id==='spec-21'?'other':id)}})},'@/components/workstreams-list':{WorkstreamsList:()=>null}})
 const tree=await h.load('../app/workstreams/page.tsx').default({searchParams:Promise.resolve({view:'all',page:'2'})}),props=nodes(tree,n=>n.props?.rows)[0].props
 assert.equal(props.view,'all');assert.equal(props.page,2);assert.equal(props.rows.length,20)
 assert.deepEqual(calls,Array.from({length:20},(_,i)=>`spec-${i+20}`))
 assert.equal(props.rows[0].progress,null);assert.equal(props.rows[1].progress,null)
 assert.equal(props.rows[2].progress.percent,50)
 assert.ok(props.rows.every(r=>Object.keys(r).sort().join(',')==='latestFixup,progress,workstream'))
 calls.length=0
 await h.load('../app/workstreams/page.tsx').default({searchParams:Promise.resolve({view:'cancelled'})});assert.deepEqual(calls,[])
})

test('discovery breaker: typed fixups require exact ownership and exclude abandoned or keyword-only changes',()=>{
 const lib=harness().load('./workstream-list.ts'),turns=[turn('old',a),turn('latest',a,'fix','open','2026-09-07T00:00:00Z'),turn('wrong',b,'fix','closed','2026-09-09T00:00:00Z'),turn('abandoned',a,'fix','abandoned','2026-09-10T00:00:00Z'),turn('keyword',a,'feature','closed','2026-09-11T00:00:00Z'),turn('orphan',undefined)]
 const before=structuredClone(turns)
 assert.deepEqual(lib.workstreamFixups(turns,a).map(t=>t.id),['latest','old'])
 assert.equal(lib.isFixup(turns[4]),false);assert.equal(lib.isFixup(turns[5]),false)
 assert.deepEqual(turns,before)
})

test('discovery breaker: list rows preserve filter and paging links, unknown readiness and exact fixup targets',()=>{
 const h=harness(),lib=h.load('./workstream-list.ts'),List=h.load('../components/workstreams-list.tsx').WorkstreamsList
 assert.equal(lib.specListProgress(a,projection(b)),null);assert.equal(lib.specListProgress(a,null),null)
 assert.equal(lib.specListProgress(a,projection(a)).percent,50)
 assert.equal(lib.specListProgress(a,projection(a,true)).percent,100)
 const unknown=projection(a,true);unknown.session.criteria=[];assert.equal(lib.specListProgress(a,unknown).percent,null)
 const rows=[{workstream:{id:a,title:'Readable title',status:'done'},progress:lib.specListProgress(a,unknown),latestFixup:{...turn('repair',a,'fix','open'),title:'Correct the counts'}},{workstream:{id:b,title:'Cancelled',status:'cancelled'},progress:{percent:100,done:1,total:1},latestFixup:null}]
 const html=h.render(React.createElement(List,{rows,view:'all',counts:{active:0,all:2,completed:1,cancelled:1},page:2,pages:3,observedAt:'2026-09-06T12:00:00Z'}))
 for(const view of ['active','all','completed','cancelled'])assert.ok(html.includes(`href="/workstreams?view=${view}"`))
 for(const page of [1,3])assert.ok(html.includes(`href="/workstreams?view=all&amp;page=${page}"`))
 assert.match(html,/aria-current="page"/);assert.match(html,/Current readiness/);assert.match(html,/Progress unavailable/);assert.match(html,/Completed earlier; current work needs rechecking/)
 assert.match(html,/href="\/turns\/repair"/);assert.match(html,/Fixup/);assert.match(html,/In progress/)
 assert.doesNotMatch(html,/aria-valuenow=/);assert.equal((html.match(/role="progressbar"/g)??[]).length,1)
 for(const view of ['active','all','completed','cancelled'])assert.match(h.render(React.createElement(List,{rows:[],view,counts:{active:0,all:0,completed:0,cancelled:0},page:1,pages:1,observedAt:'2026-09-06'})),/No .*specs/)
})

test('discovery breaker: fixup context precedes evidence and badges follow typed intent on both change rows',()=>{
 const tag=name=>({children})=>React.createElement('div',{'data-section':name},children)
 const h=harness({'@/components/turn-evidence':{TurnEvidence:tag('evidence')},'@nessalabs/ui':Object.fromEntries(['Badge','Card','CardContent','CardDescription','CardHeader','CardTitle'].map(k=>[k,tag(k)])),
 '@/components/static-mermaid':{StaticMermaid:tag('chart')},'@/components/turn-files':{TurnFilesCard:tag('files')},'@/components/turn-doc-split':{RelatedDocsList:tag('docs')},'@/components/turn-plan-section':{TurnPlanSection:tag('plan')},'@/components/freshness-badge':{FreshnessBadge:tag('freshness'),TurnVerifyBadge:tag('verify')}})
 const {TurnDetail,TurnSummaryCard}=h.load('../components/turn-detail.tsx'),{CompactTurnRow}=h.load('../components/compact-turn-row.tsx')
 const fix={...turn('repair',a),intent:{...turn('repair',a).intent,userPrompt:'Show unfinished tasks clearly'}}
 const episode={decisions:[{id:'discovery',decision:'Correct progress',rationale:'User correction',discovery:{observation:'All checks passed while tasks remained',cause:'Checks were counted as completion'}}],reviews:[],probes:[],flows:[]}
 const html=h.render(React.createElement(TurnDetail,{turn:fix,report:null,workstream:{id:a,title:'Owning spec'},episode,evidence:{}}))
 assert.ok(html.indexOf('Requested correction')<html.indexOf('data-section="evidence"'))
 assert.ok(html.indexOf('All checks passed while tasks remained')<html.indexOf('data-section="evidence"'))
 assert.match(html,/href="\/workstreams\/12f1d531-468a-4832-a1ef-2aafbfef818d"/)
 assert.match(html,/Show unfinished tasks clearly/);assert.match(html,/Checks were counted as completion/)
 for(const Component of [CompactTurnRow,TurnSummaryCard]){
  const positive=h.render(React.createElement(Component,{turn:fix,report:null,workstreamTitle:'Owning spec'}))
  assert.match(positive,/>Fixup</);assert.match(positive,/href="\/turns\/repair"/)
  const negative=h.render(React.createElement(Component,{turn:turn('feature',a,'feature'),report:null,workstreamTitle:'Owning spec'}))
  assert.doesNotMatch(negative,/>Fixup</)
 }
 const ordinary=h.render(React.createElement(TurnDetail,{turn:turn('feature',a,'feature'),report:null,evidence:{}}))
 assert.doesNotMatch(ordinary,/Requested correction/)
})

test('discovery breaker: refresh is explicit and preserves current filter while native links retain browser navigation',()=>{
 let refreshes=0,transitions=0
 const h=harness({react:{...React,useTransition:()=>[false,fn=>{transitions++;fn()}]},'next/navigation':{useRouter:()=>({refresh(){refreshes++}})}})
 const List=h.load('../components/workstreams-list.tsx').WorkstreamsList
 // Call inside a real provider/render dispatcher, then capture its returned tree for the button action.
 let tree
 const Capture=()=>{tree=List({rows:[],view:'completed',counts:{active:0,all:0,completed:0,cancelled:0},page:1,pages:1,observedAt:'2026-09-06'});return tree}
 h.render(React.createElement(Capture))
 const button=nodes(tree,n=>n.type==='button')[0];assert.equal(button.props.type,'button');button.props.onClick()
 assert.equal(refreshes,1);assert.equal(transitions,1)
 const links=nodes(tree,n=>n.props?.href?.startsWith('/workstreams?view='))
 assert.equal(links.length,4)
 assert.ok(links.every(n=>n.props.onClick===undefined&&n.props.tabIndex===undefined),'ordinary links support keyboard, modified click and browser history without intercepted events')
 assert.equal(links.find(n=>n.props['aria-current']==='page').props.href,'/workstreams?view=completed')
})
