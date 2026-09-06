import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { initLedger } from '../cli/init.js'
import { executeOperation } from '../application/operations.js'
import { libraryTemplate, profileAsProfile } from './index.js'
import { createLocalWorkflowBridge } from './local-ui.js'

test('library operations preserve actor/reason, retry identity and independent pointer conflicts', () => {
 const root = mkdtempSync(join(tmpdir(), 'sl-library-ops-')); initLedger(root, 'test')
 try {
  const metadata = () => ({requestId: randomUUID(), actor:'test:person', reason:'Team workflow'})
  const {id: _id, ...draft} = libraryTemplate(root)
  const input = {...metadata(), profile: draft}
  const saved = executeOperation(root,'save_workflow_profile',input) as any
  assert.deepEqual(executeOperation(root,'save_workflow_profile',input),saved)
  const initial = executeOperation(root,'list_workflow_profiles',{}) as any
  executeOperation(root,'set_default_workflow_profile',{...metadata(),profileId:saved.value.id,expectedDigest:initial.default.digest})
  assert.throws(()=>executeOperation(root,'set_default_workflow_profile',{...metadata(),profileId:null,expectedDigest:initial.default.digest}),/changed/)
  executeOperation(root,'update_workflow_profile',{...metadata(),profile:{...profileAsProfile(saved.value),title:'Renamed'},expectedDigest:saved.value.digest})
  assert.throws(()=>executeOperation(root,'delete_workflow_profile',{...metadata(),profileId:saved.value.id,expectedDigest:saved.value.digest}),/changed/)
  const current=executeOperation(root,'get_workflow_profile',{profileId:saved.value.id}) as any
  executeOperation(root,'delete_workflow_profile',{...metadata(),profileId:saved.value.id,expectedDigest:current.digest})
  assert.equal((executeOperation(root,'list_workflow_profiles',{}) as any).default.profileId,null)
  const receipts = readdirSync(join(root,'.spec-ledger/operations')).filter(f=>f.endsWith('.finished.json')).map(f=>JSON.parse(readFileSync(join(root,'.spec-ledger/operations',f),'utf8')))
  assert.ok(receipts.filter(r=>r.outcome==='succeeded').every(r=>r.result.actor==='test:person' && r.result.reason==='Team workflow'))
 } finally {rmSync(root,{recursive:true,force:true})}
})

test('local library route denies unsafe requests before mutation and accepts a valid save', async () => {
 const root=mkdtempSync(join(tmpdir(),'sl-library-local-')); initLedger(root,'test')
 try {
  const bridge=createLocalWorkflowBridge(root), url='http://127.0.0.1:3737/api/workflows?library=true'
  const {token}=await (await bridge(new Request(url))).json() as any
  const body=JSON.stringify({action:'save',input:{requestId:randomUUID(),actor:'local:user',reason:'Save template',profile:(({id, ...draft})=>draft)(libraryTemplate(root))}})
  for(const headers of [ {'origin':'http://evil.test','x-spec-ledger-token':token}, {'origin':'http://127.0.0.1:3737','x-spec-ledger-token':'wrong'}]) {
   assert.equal((await bridge(new Request(url,{method:'POST',headers:{...headers,'content-type':'application/json'},body}))).status,403)
  }
  const headers={'origin':'http://127.0.0.1:3737','x-spec-ledger-token':token,'content-type':'application/json'}
  assert.equal((await bridge(new Request(url,{method:'POST',headers,body:'{'}))).status,400)
  assert.equal((await bridge(new Request(url,{method:'POST',headers,body:' '.repeat(131073)}))).status,413)
  assert.deepEqual((executeOperation(root,'list_workflow_profiles',{}) as any).entries,[])
  assert.equal((await bridge(new Request(url,{method:'POST',headers,body}))).status,200)
  assert.equal((executeOperation(root,'list_workflow_profiles',{}) as any).entries.length,1)
 } finally {rmSync(root,{recursive:true,force:true})}
})
