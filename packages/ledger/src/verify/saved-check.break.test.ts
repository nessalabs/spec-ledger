import {randomUUID} from 'node:crypto'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,mkdtempSync,writeFileSync,rmSync,symlinkSync,readdirSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {initLedger} from '../cli/init.js'
import {writeJson} from '../fs/load.js'
import {executeOperation} from '../application/operations.js'
import {getCheckEvidence,getCheckRun,executeSavedRun,type CheckRun} from './saved-check.js'
import {createLocalCheckBridge} from './local-check.js'
function fixture(script="console.log('ok')") {const root=mkdtempSync(join(tmpdir(),'sl-run-break-'));initLedger(root,'breaker');writeFileSync(join(root,'check.cjs'),script);writeJson(join(root,'.spec-ledger/claims/C.json'),{id:'C',statement:'check',required:true});writeJson(join(root,'.spec-ledger/bindings/B.json'),{id:'B',claimId:'C',kind:'test',locator:{type:'command',command:'node check.cjs'}});return root}
function input(root:string,id='breaker-request-1'){const e=getCheckEvidence(root,'B');return{requestId:id,bindingId:'B',expectedSourceDigest:e.sourceDigest!,expectedCheckDigest:e.checkDigest}}
async function finish(root:string,id:string){for(let i=0;i<200;i++){const r=getCheckRun(root,id);// A finished receipt is published before the report and operation receipt.
// Wait for the owned execution guard to release before deleting the fixture.
if(r.state==='unknown'||(r.state==='finished'&&!existsSync(join(root,'.spec-ledger/evidence/check-runs/.execution-lock'))))return r;await new Promise(r=>setTimeout(r,25))}throw Error('worker did not finish')}
test('source changes during a saved check cannot produce a passing outcome',async()=>{const root=fixture("require('fs').writeFileSync('changed.txt','changed');console.log('ok')");try{const r=executeOperation(root,'run_saved_check',input(root)) as CheckRun;assert.equal((await finish(root,r.runId)).outcome,'missing');assert.notEqual(getCheckEvidence(root,'B').currentOutcome,'pass')}finally{rmSync(root,{recursive:true,force:true})}})
test('large stdout and stderr drain without unbounded capture and retain intact hashes',async()=>{const root=fixture("process.stdout.write('x'.repeat(200000));process.stderr.write('y'.repeat(200000))");try{const r=executeOperation(root,'run_saved_check',input(root)) as CheckRun,c=await finish(root,r.runId);assert.equal(c.outcome,'pass');for(const o of[c.stdout,c.stderr]){assert.equal(o?.status,'intact');assert.equal(o?.truncated,true);assert.ok(Buffer.byteLength(o!.text!)<=32768)}}finally{rmSync(root,{recursive:true,force:true})}})
test('overlapping new requests are rejected while retry returns the original identity',async()=>{const root=fixture("setTimeout(()=>console.log('finished'),350)");try{const i=input(root),r=executeOperation(root,'run_saved_check',i) as CheckRun;assert.equal((executeOperation(root,'run_saved_check',i) as CheckRun).runId,r.runId);assert.throws(()=>executeOperation(root,'run_saved_check',{...i,requestId:'second-request-1'}),/owns this checkout|busy/);await finish(root,r.runId);assert.equal(getCheckEvidence(root,'B').runs.length,1)}finally{rmSync(root,{recursive:true,force:true})}})
test('local malformed and cross-origin actions cause no execution',async()=>{const root=fixture();try{const bridge=createLocalCheckBridge(root),url='http://127.0.0.1:3737/api/checks',token=(await(await bridge(new Request(url))).json()).token;const headers={origin:'http://127.0.0.1:3737','content-type':'application/json','x-spec-ledger-token':token};for(const [h,body] of [[{...headers,origin:'http://evil.invalid'},JSON.stringify(input(root))],[{...headers,'x-spec-ledger-token':'wrong'},JSON.stringify(input(root))],[headers,JSON.stringify({...input(root),cwd:'/tmp'})],[headers,'x'.repeat(5000)]] as const){assert.ok((await bridge(new Request(url,{method:'POST',headers:h,body}))).status>=400)}assert.equal(getCheckEvidence(root,'B').runs.length,0)}finally{rmSync(root,{recursive:true,force:true})}})
test('symlinked receipt directory cannot receive check writes outside the checkout',async()=>{const root=fixture(),outside=mkdtempSync(join(tmpdir(),'sl-run-outside-'));try{mkdirSync(join(root,'.spec-ledger/evidence'),{recursive:true});symlinkSync(outside,join(root,'.spec-ledger/evidence/runs'),'dir');let run:CheckRun|undefined;try{run=executeOperation(root,'run_saved_check',input(root)) as CheckRun}catch{}if(run)await finish(root,run.runId);assert.deepEqual(readdirSync(outside),[],'worker must not write a receipt outside checkout')}finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true})}})

test('stale displayed inputs reject before worker creation and never switch to a changed command',()=>{const root=fixture();try{const i=input(root);writeFileSync(join(root,'check.cjs'),"console.log('changed')");assert.throws(()=>executeOperation(root,'run_saved_check',i),/changed|Refresh/);assert.equal(getCheckEvidence(root,'B').runs.length,0)}finally{rmSync(root,{recursive:true,force:true})}})
test('nonzero exit retains actual diagnostics and does not pass',async()=>{const root=fixture("console.error('assertion failed: expected hello, actual goodbye');process.exit(9)");try{const r=executeOperation(root,'run_saved_check',input(root)) as CheckRun,c=await finish(root,r.runId);assert.equal(c.state,'finished');assert.equal(c.outcome,'fail');assert.equal(c.exitCode,9);assert.match(c.stderr!.text!,/actual goodbye/);assert.equal(getCheckEvidence(root,'B').currentOutcome,'fail')}finally{rmSync(root,{recursive:true,force:true})}})


test('timeout terminates the owned command before releasing the guard and records signal',async()=>{
 const root=fixture("setInterval(()=>{},1000)"),runId=randomUUID(),realTimer=globalThis.setTimeout
 try{
  const i=input(root),base=join(root,'.spec-ledger/evidence/check-runs');mkdirSync(join(base,'.execution-lock'),{recursive:true});writeFileSync(join(base,'.execution-lock/owner'),runId)
  writeJson(join(base,`${runId}.json`),{runId,requestId:i.requestId,bindingId:'B',state:'queued',command:'node check.cjs',cwd:root,sourceDigest:i.expectedSourceDigest,checkDigest:i.expectedCheckDigest,startedAt:new Date().toISOString()})
  // Compress only the runner timeout; retain real child process/group termination and filesystem effects.
  globalThis.setTimeout=((callback: (...args:unknown[])=>void,ms?:number,...args:unknown[])=>realTimer(callback,ms===120000?75:ms,...args)) as typeof setTimeout
  await executeSavedRun(root,runId)
  const run=getCheckRun(root,runId);assert.equal(run.state,'finished');assert.equal(run.outcome,'fail');assert.match(run.reason!,/120 second/);assert.equal(run.signal,'SIGKILL');assert.ok(!readdirSync(base).includes('.execution-lock'))
 }finally{globalThis.setTimeout=realTimer;rmSync(root,{recursive:true,force:true})}
})
