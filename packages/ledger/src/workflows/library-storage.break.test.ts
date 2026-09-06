import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { initLedger } from '../cli/init.js'
import { executeOperation } from '../application/operations.js'
import { libraryTemplate } from './index.js'
import { createLocalWorkflowBridge } from './local-ui.js'
const meta=()=>({requestId:randomUUID(),actor:'breaker:person',reason:'Check confinement'})
test('library refuses symlinked profile storage without touching external files',()=>{
 const root=mkdtempSync(join(tmpdir(),'sl-library-link-')),outside=mkdtempSync(join(tmpdir(),'sl-library-outside-'));initLedger(root,'break')
 try {
  mkdirSync(join(root,'.spec-ledger/workflows'),{recursive:true});symlinkSync(outside,join(root,'.spec-ledger/workflows/library'))
  writeFileSync(join(outside,'sentinel'),'unchanged')
  assert.throws(()=>executeOperation(root,'save_workflow_profile',{...meta(),profile:libraryTemplate(root)}),/symlink/)
  assert.equal(readFileSync(join(outside,'sentinel'),'utf8'),'unchanged');assert.equal(existsSync(join(outside,'my-workflow.json')),false)
 }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true})}
})
test('a refused delete with an unsafe default pointer preserves the saved workflow',()=>{
 const root=mkdtempSync(join(tmpdir(),'sl-library-partial-')),outside=mkdtempSync(join(tmpdir(),'sl-library-pointer-'));initLedger(root,'break')
 try {
  const profile=libraryTemplate(root),saved=executeOperation(root,'save_workflow_profile',{...meta(),profile}) as any
  const pointer=join(outside,'pointer.json');writeFileSync(pointer,JSON.stringify({schemaVersion:1,profileId:profile.id}))
  symlinkSync(pointer,join(root,'.spec-ledger/workflows/default-profile.json'))
  assert.throws(()=>executeOperation(root,'delete_workflow_profile',{...meta(),profileId:profile.id,expectedDigest:saved.value.digest}),/symlink/)
  assert.equal(existsSync(join(root,'.spec-ledger/workflows/library',`${profile.id}.json`)),true,'a rejected operation must not delete the profile')
 }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true})}
})
test('local library poison and cross-site requests cannot create profiles',async()=>{
 const root=mkdtempSync(join(tmpdir(),'sl-library-poison-'));initLedger(root,'break')
 try{
  const bridge=createLocalWorkflowBridge(root),url='http://127.0.0.1:3737/api/workflows?library=true'
  const {token}=await(await bridge(new Request(url))).json() as any
  const headers={'origin':'http://127.0.0.1:3737','content-type':'application/json','x-spec-ledger-token':token}
  for(const body of ['null','[]','true','{"action":"save","input":null}','{"action":"save","input":{"profile":null}}','{"action":"save","input":{}}','{',' '.repeat(131073)]) {
   assert.ok((await bridge(new Request(url,{method:'POST',headers,body}))).status>=400)
  }
  const body=JSON.stringify({action:'save',input:{...meta(),profile:libraryTemplate(root)}})
  for(const attack of [{'sec-fetch-site':'cross-site'},{origin:'http://evil.test'},{host:'evil.test:3737'},{'x-spec-ledger-token':'wrong'}] as Record<string,string>[]) {
   assert.equal((await bridge(new Request(url,{method:'POST',headers:{...headers,...attack},body}))).status,403)
  }
  assert.deepEqual((executeOperation(root,'list_workflow_profiles',{}) as any).entries,[])
  assert.equal((await bridge(new Request(url,{method:'POST',headers,body}))).status,200)
 }finally{rmSync(root,{recursive:true,force:true})}
})
