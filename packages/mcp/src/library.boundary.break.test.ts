import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { initLedger, libraryTemplate } from '@nessalabs/spec-ledger'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
const here=dirname(fileURLToPath(import.meta.url))
for (const surface of ['cli','mcp']) test(`${surface} boundary: library retries and stale versions cannot overwrite current choices`,async()=>{
 const root=mkdtempSync(join(tmpdir(),'sl-library-boundary-')); initLedger(root,'break')
 const client=new Client({name:'library-break',version:'1'})
 if(surface==='mcp') await client.connect(new StdioClientTransport({command:process.execPath,args:[join(here,'main.js'),'--root',root],stderr:'pipe'}))
 const call=async(name:string,input:Record<string,unknown>):Promise<any>=>{
  if(surface==='mcp') return (await client.callTool({name,arguments:input})).structuredContent
  const file=join(root,'input.json');writeFileSync(file,JSON.stringify(input))
  const r=spawnSync(process.execPath,[join(here,'../../ledger/dist/cli/main.js'),'operation',name,'--file',file,'--root',root],{encoding:'utf8'})
  const envelope=JSON.parse(r.stdout);assert.equal(r.status,envelope.ok?0:1,r.stderr);return envelope
 }
 const invoke=async(name:string,input:Record<string,unknown>)=>{const e=await call(name,input);assert.equal(e.ok,true,JSON.stringify(e));return e.result}
 const meta=()=>({requestId:randomUUID(),actor:'breaker:person',reason:'Check saved workflows'})
 try {
  const options=await invoke('get_workflow_library_options',{})
  let profile=options.defaultProfile
  const {id:templateId,...newProfile}=profile;void templateId
  const input={...meta(),profile:newProfile}
  assert.deepEqual(profile,JSON.parse(JSON.stringify(libraryTemplate(root))))
  await invoke('preview_workflow_profile',{profile})
  assert.equal((await call('preview_workflow_profile',{profile:{...profile,stages:[]}})).ok,false)
  assert.deepEqual((await invoke('list_workflow_profiles',{})).entries,[])
  const saved=await invoke('save_workflow_profile',input)
  assert.deepEqual(await invoke('save_workflow_profile',input),saved)
  profile={id:saved.value.id,title:saved.value.title,skills:saved.value.skills,stages:saved.value.stages}
  writeFileSync(join(root,'.spec-ledger/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad.json'),JSON.stringify({schemaVersion:1,id:'2b74bc14-227a-5c05-b2ed-1c32d9703cad',status:'shaped',title:'Preview target',createdAt:'2026-01-01T00:00:00.000Z',problem:'p',objective:'o',featureIds:[],acceptanceCriteria:['One','Two'],policy:{requireSpecBreak:false,requireCodeBreak:false}}))
  const preview=await invoke('preview_workflow',{workstreamId:'2b74bc14-227a-5c05-b2ed-1c32d9703cad',profileId:profile.id})
  assert.equal(preview.profile.source,'library');assert.equal(preview.profile.profileDigest,saved.value.digest)
  assert.deepEqual(preview.stages.find((s:any)=>s.role==='verify').steps[0].outputs[0].criterionIds,['AC-1','AC-2'])
  assert.equal((await call('preview_workflow',{workstreamId:'2b74bc14-227a-5c05-b2ed-1c32d9703cad',profileId:profile.id,profile})).ok,false)
  assert.equal((await call('save_workflow_profile',{...meta(),profile})).ok,false)
  const initial=await invoke('list_workflow_profiles',{})
  await invoke('set_default_workflow_profile',{...meta(),profileId:profile.id,expectedDigest:initial.default.digest})
  const stale=await call('set_default_workflow_profile',{...meta(),profileId:null,expectedDigest:initial.default.digest})
  assert.equal(stale.ok,false);assert.equal(stale.error.code,'revision_conflict')
  assert.equal((await invoke('list_workflow_profiles',{})).default.profileId,profile.id)
  const updated=await invoke('update_workflow_profile',{...meta(),profile:{...profile,title:'New title'},expectedDigest:saved.value.digest})
  for(const name of ['update_workflow_profile','delete_workflow_profile']) {
   const rejected=await call(name,{...meta(),...(name.startsWith('update')?{profile}:{profileId:profile.id}),expectedDigest:saved.value.digest})
   assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'revision_conflict')
  }
  assert.equal((await invoke('get_workflow_profile',{profileId:profile.id})).title,'New title')
  await invoke('delete_workflow_profile',{...meta(),profileId:profile.id,expectedDigest:updated.value.digest})
  const final=await invoke('list_workflow_profiles',{});assert.deepEqual(final.entries,[]);assert.equal(final.default.profileId,null)
 } finally {if(surface==='mcp')await client.close();rmSync(root,{recursive:true,force:true})}
})
