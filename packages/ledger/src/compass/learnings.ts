import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { loadLedger, sha256Stable } from "../fs/load.js"

export interface Learning {
  schemaVersion:1
  id:string
  statement:string
  workstreamId?:string
  featureIds?:string[]
  source:{kind:"user-reported"|"agent-inferred";reference:string}
  supersedes?:string[]
  supersedesTenetIds?:string[]
  createdAt:string
}
export function listLearnings(root:string):Learning[] {
  const dir=join(loadLedger(root).rootDir,"learnings")
  return existsSync(dir) ? readdirSync(dir).filter(n=>n.endsWith(".json")).sort().map(n=>JSON.parse(readFileSync(join(dir,n),"utf8"))) : []
}
export function applicableLearnings(root:string,workstreamId:string,featureIds:string[]):Learning[] {
  const scoped=listLearnings(root).filter(l=>l.source?.kind==="user-reported" && (!l.workstreamId || l.workstreamId===workstreamId) && (!l.featureIds?.length || l.featureIds.some(f=>featureIds.includes(f))))
  const superseded=new Set(scoped.flatMap(l=>l.supersedes ?? []))
  return scoped.filter(l=>!superseded.has(l.id))
}
export function recordLearning(root:string,input:Omit<Learning,"id"|"schemaVersion"|"createdAt"> & {id?:string}):Learning {
  if (!input.statement?.trim() || !input.source?.reference?.trim() || !["user-reported","agent-inferred"].includes(input.source.kind)) throw new Error("learning requires a statement and attributed source")
  const existing=listLearnings(root)
  if ((input.supersedes ?? []).some(id=>!existing.some(l=>l.id===id))) throw new Error("superseded learning not found")
  const id=input.id ?? `LN-${randomUUID()}`
  if (!/^LN-[a-zA-Z0-9_-]+$/.test(id)) throw new Error("invalid learning ID")
  const record:Learning={...input,id,schemaVersion:1,createdAt:new Date().toISOString()}
  const dir=join(loadLedger(root).rootDir,"learnings");mkdirSync(dir,{recursive:true})
  try {writeFileSync(join(dir,`${id}.json`),JSON.stringify(record,null,2)+"\n",{flag:"wx"})}
  catch(error) {
    const prior=existing.find(l=>l.id===id)
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !prior || sha256Stable({...prior,createdAt:null})!==sha256Stable({...record,createdAt:null})) throw error
    return prior
  }
  return record
}
