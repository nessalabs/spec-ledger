import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const ts=createRequire(new URL('../../ledger/package.json',import.meta.url))('typescript')
function harness(stored=new Map()) {
 let state=[],cursor=0,effects=[]
 const react={useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>state[i]=value]},useEffect:fn=>effects.push(fn)}
 const output=ts.transpileModule(readFileSync(new URL('./workflow-api.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const mod={exports:{}};new Function('require','module','exports',output)(id=>id==='react'?react:require(id),mod,mod.exports)
 return {api:mod.exports,storage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},stored,render:()=>{cursor=0;effects=[];return mod.exports.useWorkflowMutation('test:pending')},mount:()=>effects.forEach(fn=>fn())}
}
const request={action:'save',input:{requestId:'original-id',actor:'browser',reason:'Test',profile:{title:'Original'}}}
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}})
test('lost reply survives reload and retry preserves the exact operation instead of accepting another edit',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.sessionStorage
 const first=harness();globalThis.sessionStorage=first.storage
 const bodies=[]
 globalThis.fetch=async(url,options)=>{if(options.method==='POST'){bodies.push(options.body);throw Error('Connection lost after commit')}return json({token:'local-token'})}
 try {
  let hook=first.render();first.mount();assert.equal(await hook.run(request),false)
  assert.equal(first.stored.get('test:pending'),JSON.stringify(request))
  const reloaded=harness(first.stored);globalThis.sessionStorage=reloaded.storage;reloaded.render();reloaded.mount();hook=reloaded.render()
  assert.deepEqual(hook.pending,request)
  globalThis.fetch=async(url,options)=>{if(options.method==='POST'){bodies.push(options.body);return json({ok:true})}return json({token:'fresh-token'})}
  assert.equal(await hook.run({action:'delete',input:{requestId:'wrong-id'}}),true)
  assert.deepEqual(bodies,[JSON.stringify(request),JSON.stringify(request)])
  assert.equal(first.stored.size,0)
 } finally {globalThis.fetch=oldFetch;globalThis.sessionStorage=oldStorage}
})
test('unknown and busy outcomes retain recovery but a definitive stale-version conflict releases the form',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.sessionStorage
 try {for(const code of ['execution_unknown','operation_busy','stale_version']){
  const h=harness();globalThis.sessionStorage=h.storage
  globalThis.fetch=async(url,options)=>options.method==='POST'?json({error:'Rejected',code},409):json({token:'token'})
  assert.equal(await h.render().run(request),false)
  assert.equal(h.stored.has('test:pending'),code!=='stale_version',code)
 }} finally {globalThis.fetch=oldFetch;globalThis.sessionStorage=oldStorage}
})
test('unreadable mutation response keeps the original request for recovery',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.sessionStorage;const h=harness();globalThis.sessionStorage=h.storage
 globalThis.fetch=async(url,options)=>options.method==='POST'?new Response('upstream died',{status:502}):json({token:'token'})
 try {assert.equal(await h.render().run(request),false);assert.equal(h.stored.get('test:pending'),JSON.stringify(request))}
 finally {globalThis.fetch=oldFetch;globalThis.sessionStorage=oldStorage}
})
test('a browser unable to persist recovery must not send an unrecoverable write',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.sessionStorage;const h=harness();let calls=0
 globalThis.sessionStorage={...h.storage,setItem(){throw Error('Storage denied')}};globalThis.fetch=async()=>{calls++;return json({token:'token'})}
 try {assert.equal(await h.render().run(request),false);assert.equal(calls,0)}
 finally {globalThis.fetch=oldFetch;globalThis.sessionStorage=oldStorage}
})
