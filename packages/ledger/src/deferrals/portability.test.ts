import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { initLedger } from "../cli/init.js"
import { writeJson } from "../fs/load.js"
import { loadWorkstream } from "../workstream/load.js"

function fixture() {
  const root=mkdtempSync(join(tmpdir(),"sl-portable-work-"))
  function git(args:string[]) {
    const result=spawnSync("git",args,{cwd:root,encoding:"utf8"})
    assert.equal(result.status,0,result.stderr)
    return result.stdout.trim()
  }
  function cli(args:string[]) {
    return spawnSync(process.execPath,[fileURLToPath(new URL("../cli/main.js",import.meta.url)),...args,"--root",root],{encoding:"utf8"})
  }
  git(["init","-q"]);git(["config","user.email","fixture@example.invalid"]);git(["config","user.name","Fixture"])
  initLedger(root,"portable work")
  writeFileSync(join(root,"product.txt"),"initial behavior\n")
  writeJson(join(root,".spec-ledger/workstreams/W-001.json"),{schemaVersion:1,id:"W-001",status:"shaped",title:"Implement delegated behavior",problem:"Fixture",objective:"Fixture",createdAt:"2026-01-01",featureIds:["verify"],policy:{requireSpecBreak:true},specBreakReviewId:"W-001/SR-01",suggestedSlices:[{id:"SLC-01",title:"Visible behavior",kind:"vertical",acceptance:["Works"]}]})
  let result=cli(["permission","delegate","--workstream","W-001","--features","verify","--source","User explicitly delegated this fixture request"])
  assert.equal(result.status,0,result.stderr)
  writeJson(join(root,"review-input.json"),{schemaVersion:1,id:"W-001/SR-01",workstreamId:"W-001",target:"spec",kind:"adversarial",reviewer:"fixture",verdict:"approve",summary:"Fixture acceptance is bounded",plainSummary:"The plan has clear acceptance."})
  result=cli(["review","spec","--file",join(root,"review-input.json")])
  assert.equal(result.status,0,result.stderr)
  git(["add","."]);git(["commit","-qm","Prepared authorized fixture"])
  return {root,cli,git}
}

test("portable work opens a clean delegated plan without treating its own snapshot as dirty user work",()=> {
  const {root,cli,git}=fixture()
  try {
    assert.equal(git(["status","--porcelain"]),"")
    const plan=cli(["plan","--workstream","W-001"])
    assert.equal(plan.status,0,plan.stderr)
    assert.equal(JSON.parse(plan.stdout).nextAction,"work")
    assert.equal(loadWorkstream(root,"W-001").seal,undefined)
    const work=cli(["work","--workstream","W-001","--slice","SLC-01","--goal","User-visible outcome"])
    assert.equal(work.status,0,work.stderr)
    const turn=JSON.parse(readFileSync(join(root,".spec-ledger/turns/T-001.json"),"utf8"))
    assert.equal(turn.status,"open")
    assert.ok(turn.opened.contextDigest)
    assert.deepEqual(turn.opened.dirtyAtOpen,[])
    assert.match(loadWorkstream(root,"W-001").seal!.sealedBy,/^agent:permission:AUTH-/)
  } finally {rmSync(root,{recursive:true,force:true})}
})

test("portable work refuses pre-existing dirty source before creating a delegated snapshot",()=> {
  const {root,cli}=fixture()
  try {
    writeFileSync(join(root,"product.txt"),"unrelated unfinished change\n")
    const work=cli(["work","--workstream","W-001","--slice","SLC-01","--goal","User-visible outcome"])
    assert.notEqual(work.status,0)
    assert.match(work.stderr,/dirty worktree/)
    assert.equal(loadWorkstream(root,"W-001").seal,undefined)
  } finally {rmSync(root,{recursive:true,force:true})}
})
