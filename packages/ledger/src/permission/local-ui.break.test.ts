import {describe,it} from "node:test"
import assert from "node:assert/strict"
import {mkdtempSync,rmSync,readdirSync,readFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {initLedger} from "../cli/init.js"
import {writeJson} from "../fs/load.js"
import {loadWorkstream} from "../workstream/load.js"
import {createLocalApprovalBridge,authorityStateDigest} from "./local-ui.js"
import {planRevision,permissionStatus,recordAuthority,listAuthorities} from "./authority.js"
const endpoint="http://127.0.0.1:3737/api/approval"
function fixture(){
 const root=mkdtempSync(join(tmpdir(),"sl-ui-approval-break-"));initLedger(root,"local approval breaker")
 writeJson(join(root,".spec-ledger/workstreams/W-001.json"),{schemaVersion:1,id:"W-001",status:"shaped",title:"Review this plan",featureIds:["alpha"],policy:{requireSpecBreak:false},suggestedSlices:[{id:"SLC-01",title:"Build",kind:"vertical",acceptance:["Works"]}]})
 return {root,bridge:createLocalApprovalBridge(root)}
}
function state(root:string){return Object.fromEntries(readdirSync(root,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>[join(e.parentPath,e.name),readFileSync(join(e.parentPath,e.name)).toString("base64")]))}
function payload(root:string,requestId="request-0123456789"){return {action:"approve",workstreamId:"W-001",revisionDigest:planRevision(root,loadWorkstream(root,"W-001")),authorityDigest:authorityStateDigest(root),requestId}}
function post(token:string,body:unknown,headers:Record<string,string>={},url=endpoint){return new Request(url,{method:"POST",headers:{origin:"http://127.0.0.1:3737","content-type":"application/json","x-spec-ledger-token":token,...headers},body:JSON.stringify(body)})}
async function token(bridge:ReturnType<typeof createLocalApprovalBridge>){const res=await bridge(new Request(endpoint));assert.equal(res.status,200);assert.equal(res.headers.get("cache-control"),"no-store");return (await res.json()).token as string}

describe("local UI approval boundary adversarial",()=>{
 it("supports Next-normalized loopback URLs while binding origin to the external Host and port",async()=>{
  const {root,bridge}=fixture()
  try{
   const normalized="http://localhost:3737/api/approval"
   const headers={host:"127.0.0.1:3737",origin:"http://127.0.0.1:3737"}
   const get=await bridge(new Request(normalized,{headers}))
   assert.equal(get.status,200)
   const t=(await get.json()).token as string
   const bad=await bridge(post(t,payload(root),{...headers,host:"127.0.0.1:9999"},normalized))
   assert.equal(bad.status,403)
   const accepted=await bridge(post(t,payload(root),headers,normalized))
   assert.equal(accepted.status,200)
   assert.equal((await accepted.json()).permission.allowed,true)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("denies cross-origin and rebinding requests without ledger effects",async()=>{
  const {root,bridge}=fixture()
  try{
   const t=await token(bridge),before=state(root),body=payload(root)
   for(const request of [
    post(t,body,{origin:"https://attacker.example"}),
    post(t,body,{"sec-fetch-site":"cross-site"}),
    post(t,body,{host:"attacker.example"}),
    post(t,body,{host:"localhost.attacker.example"}),
    post(t,body,{host:"127.0.0.1:9999"}),
    post(t,body,{origin:"", "x-spec-ledger-token":""}),
    post("incorrect",body),
    new Request("http://attacker.example/api/approval"),
    new Request(endpoint,{headers:{origin:"https://attacker.example"}}),
   ]){assert.equal((await bridge(request)).status,403);assert.deepEqual(state(root),before)}
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("rejects unsupported methods, bodies, arbitrary commands, and oversized input before mutation",async()=>{
  const {root,bridge}=fixture()
  try{
   const t=await token(bridge),body=payload(root),before=state(root)
   assert.equal((await bridge(new Request(endpoint,{method:"DELETE"}))).status,405)
   assert.equal((await bridge(post(t,body,{"content-type":"text/plain"}))).status,403)
   assert.equal((await bridge(post(t,body,{"content-type":"application/jsonp"}))).status,403)
   const other=createLocalApprovalBridge(root)
   assert.equal((await other(post(t,body))).status,403,"tokens must belong to this bridge instance")
   assert.equal((await bridge(new Request(endpoint,{method:"POST",headers:{origin:"http://127.0.0.1:3737","content-type":"application/json","x-spec-ledger-token":t},body:"{"}))).status,400)
   for(const invalid of [{...body,command:"touch attacker-file"},{...body,workstreamId:"../../outside"},{...body,action:"grant-standing"},{...body,requestId:"short"},null,[]])assert.equal((await bridge(post(t,invalid))).status,400)
   assert.equal((await bridge(post(t,{...body,extra:"x".repeat(5000)}))).status,413)
   assert.deepEqual(state(root),before)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("rejects stale revision and authority state instead of silently approving new work",async()=>{
  const {root,bridge}=fixture()
  try{
   const t=await token(bridge),body=payload(root)
   const ws=loadWorkstream(root,"W-001");ws.title="A changed plan"
   writeJson(join(root,".spec-ledger/workstreams/W-001.json"),ws)
   assert.equal((await bridge(post(t,body))).status,409)
   const current=payload(root)
   recordAuthority(root,{action:"grant",mode:"standing",featureIds:["alpha"],source:{kind:"agent-reported",reference:"fixture changes authority"}})
   const before=state(root)
   assert.equal((await bridge(post(t,current))).status,409)
   assert.deepEqual(state(root),before)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("retries exactly once, rejects request ID reuse, and reports revocation after an old retry",async()=>{
  const {root,bridge}=fixture()
  try{
   const t=await token(bridge),body=payload(root)
   const saved=await bridge(post(t,body));assert.equal(saved.status,200)
   assert.equal((await saved.json()).permission.allowed,true)
   const count=listAuthorities(root).length
   assert.equal((await bridge(post(t,body))).status,200)
   assert.equal(listAuthorities(root).length,count)
   assert.equal((await bridge(post(t,{...body,action:"deny"}))).status,409)
   recordAuthority(root,{action:"revoke",targetId:`AUTH-UI-${body.requestId}`,source:{kind:"agent-reported",reference:"fixture revocation"}})
   const retry=await bridge(post(t,body));assert.equal(retry.status,200)
   const result=await retry.json();assert.equal(result.saved,true);assert.equal(result.permission.allowed,false)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
 it("supports intentional denial replacement only against the newly observed state",async()=>{
  const {root,bridge}=fixture()
  try{
   const t=await token(bridge)
   const denied=await bridge(post(t,{...payload(root),action:"deny"}));assert.equal(denied.status,200)
   assert.equal(permissionStatus(root,"W-001").allowed,false)
   const approved=await bridge(post(t,payload(root,"request-replacement-012345")));assert.equal(approved.status,200)
   const p=(await approved.json()).permission;assert.equal(p.allowed,true);assert.equal(p.provenance,"agent-reported")
   assert.match(listAuthorities(root).at(-1)!.source.reference,/not authenticated/)
  }finally{rmSync(root,{recursive:true,force:true})}
 })
})
