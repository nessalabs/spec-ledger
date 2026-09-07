import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const ts=createRequire(new URL('../../ledger/package.json',import.meta.url))('typescript')
function load(path,overrides={}){
 const m={exports:{}}
 const output=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 new Function('require','module','exports',output)(id=>overrides[id]??(id==='@/lib/workstream-list'?load('./workstream-list.ts'):id==='./acceptance-progress'?load('./acceptance-progress.ts'):require(id)),m,m.exports)
 return m.exports
}
const tick=()=>new Promise(resolve=>setImmediate(resolve))
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
const p={total:2,done:1,percent:50},full={total:2,done:2,percent:100}
const response=(id,progress=p)=>({ok:true,json:async()=>({workstreamId:id,progress})})

test('progress queue breaker: compact route isolates requested scope and never returns full session evidence',async()=>{
 let value,error=false,calls=[]
 const GET=load('../app/api/spec-progress/route.ts',{'@/lib/ledger':{serverClient:()=>({getSession:async id=>{calls.push(id);if(error)throw new Error('private failure');return value}})}}).GET
 let r=await GET(new Request('http://local/api/spec-progress'));assert.equal(r.status,400);assert.deepEqual(calls,[])
 value={session:{workstreamId:'wrong',criteria:[],completion:{checklist:[]}}}
 r=await GET(new Request('http://local/api/spec-progress?workstream=selected'))
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{workstreamId:'selected',progress:null})
 value={session:{workstreamId:'selected',secret:'not a summary',criteria:[{}],completion:{eligible:false,checklist:[{id:'criteria',state:'done'},{id:'turn',state:'todo'}]},artifacts:[{body:'raw evidence'}]}}
 r=await GET(new Request('http://local/api/spec-progress?workstream=selected'))
 assert.deepEqual(await r.json(),{workstreamId:'selected',progress:p});assert.equal(r.headers.get('cache-control'),'no-store')
 error=true;r=await GET(new Request('http://local/api/spec-progress?workstream=selected'))
 assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private failure|raw evidence/)
})

test('progress queue breaker: one request runs at a time and a failed or wrong-scope row cannot poison later progress',async()=>{
 const original=globalThis.fetch,requests=[],received=[]
 globalThis.fetch=(url,options)=>{const d=deferred();requests.push({url,options,...d});return d.promise}
 try{
  const run=load('../components/use-spec-list-progress.ts').observeListProgress(['a','b','c'],new AbortController().signal,(...args)=>received.push(args))
  assert.equal(requests.length,1);assert.equal(requests[0].options.cache,'no-store')
  requests[0].resolve({ok:false});await tick();assert.deepEqual(received,[['a',null]]);assert.equal(requests.length,2)
  requests[1].resolve(response('wrong',full));await tick();assert.deepEqual(received,[['a',null],['b',null]]);assert.equal(requests.length,3)
  requests[2].resolve(response('c'));await run;assert.deepEqual(received,[['a',null],['b',null],['c',p]])
 }finally{globalThis.fetch=original}
})

test('progress queue breaker: cancellation aborts in-flight work and excludes late results and remaining rows',async()=>{
 const original=globalThis.fetch,requests=[],received=[],controller=new AbortController()
 globalThis.fetch=(url,options)=>{const d=deferred();requests.push({url,options,...d});return d.promise}
 try{
  const run=load('../components/use-spec-list-progress.ts').observeListProgress(['old','never'],controller.signal,(...args)=>received.push(args))
  controller.abort();assert.equal(requests[0].options.signal.aborted,true)
  requests[0].resolve(response('old',full));await run
  assert.deepEqual(received,[]);assert.equal(requests.length,1)
 }finally{globalThis.fetch=original}
})

test('progress queue breaker: each deadline aborts that request and continues with the next visible row',async()=>{
 const original={fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout},timers=[],requests=[],received=[]
 globalThis.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length};globalThis.clearTimeout=()=>{}
 globalThis.fetch=(url,options)=>{const d=deferred();options.signal.addEventListener('abort',()=>d.reject(new Error('aborted')));requests.push({url,options,...d});return d.promise}
 try{
  const run=load('../components/use-spec-list-progress.ts').observeListProgress(['slow','next'],new AbortController().signal,(...args)=>received.push(args))
  assert.equal(timers[0].ms,8000);timers[0].fn();await tick()
  assert.equal(requests[0].options.signal.aborted,true);assert.deepEqual(received,[['slow',null]])
  assert.equal(requests.length,2);requests[1].resolve(response('next'));await run
  assert.deepEqual(received,[['slow',null],['next',p]])
 }finally{Object.assign(globalThis,original)}
})

function hookHarness(){
 let states=[],effects=[],cursor=0,pending=[]
 const react={useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}]},useEffect(fn,deps){const i=cursor++;const old=effects[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))pending.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()}})}}
 const hook=load('../components/use-spec-list-progress.ts',{react}).useSpecListProgress
 return {render(rows,snapshot){cursor=0;pending=[];const value=hook(rows,snapshot);pending.forEach(fn=>fn());return value},unmount(){effects.forEach(e=>e?.cleanup?.())}}
}

test('progress queue breaker: a new snapshot hides old progress immediately and late old replies cannot replace refreshed results',async()=>{
 const original=globalThis.fetch,requests=[]
 globalThis.fetch=(url,options)=>{const d=deferred();requests.push({url,options,...d});return d.promise}
 const h=hookHarness(),rows=[{workstream:{id:'same',status:'active'}},{workstream:{id:'cancelled',status:'cancelled'}}]
 try{
  assert.deepEqual(h.render(rows,'old'),{});assert.equal(requests.length,1)
  assert.deepEqual(h.render(rows,'new'),{});assert.equal(requests.length,2);assert.equal(requests[0].options.signal.aborted,true)
  requests[1].resolve(response('same',p));await tick();assert.deepEqual(h.render(rows,'new'),{same:p})
  requests[0].resolve(response('same',full));await tick();assert.deepEqual(h.render(rows,'new'),{same:p})
  const changed=[{workstream:{id:'different',status:'active'}}];assert.deepEqual(h.render(changed,'new'),{});assert.equal(requests.length,3)
  h.unmount();assert.equal(requests[2].options.signal.aborted,true);requests[2].resolve(response('different'));await tick()
  assert.ok(requests.every(r=>!r.url.includes('cancelled')))
 }finally{h.unmount();globalThis.fetch=original}
})
