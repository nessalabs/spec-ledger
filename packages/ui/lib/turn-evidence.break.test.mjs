import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = createRequire(new URL('../../ledger/package.json', import.meta.url))('typescript')
function load(path, overrides={}) {
  const compiled=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  const module={exports:{}}
  new Function('require','module','exports',compiled)(id=>id in overrides?overrides[id]:(id==='@/components/readable-text'?load('../components/readable-text.tsx'):id==='@/lib/record-labels'?load('./record-labels.ts'):require(id)),module,module.exports)
  return module.exports
}
const {evidenceForTurn,completionLabel}=load('./turn-evidence.ts')
const criterion=(id,evidence,claim)=>({id,evidence,claims:[{id:claim}]})
const session={criteria:[criterion('886b091f-57f9-5f69-9e74-f0b50275d693/AC-01','pass','130d6e32-c0de-5753-920b-2eb7b3eea90d'),criterion('05d02368-f751-5d8a-b957-c7edadcb0264/AC-01','pass','3b8042b6-2a37-5675-b8c8-d99defca030c'),criterion('12323a0d-6c53-59fb-b18b-ecfac0936883/AC-01','fail','c5626d80-946d-500e-966e-02c68507b4f8'),criterion('12323a0d-6c53-59fb-b18b-ecfac0936883/AC-02','missing','097c3141-f2c1-54a9-ba5c-aa230e01b1a5')],reviews:[{turnId:'6051f041-eac2-5d12-9a2f-8c90ad79e4bf'},{turnId:'1439c83d-8822-5496-b4dd-8e2e1fc2d30c'}],artifacts:[{turnId:'6051f041-eac2-5d12-9a2f-8c90ad79e4bf',id:'82dee788-b5c4-5cd1-ae62-9d2f00d39599'},{turnId:'1439c83d-8822-5496-b4dd-8e2e1fc2d30c',id:'77b6ee9e-440f-5ce8-93f6-4b71e4cab12e'}],evidenceCount:2}
test('turn evidence excludes adjacent slice prefixes and preserves failed/missing verdicts',()=>{
  const scoped=evidenceForTurn(session,{id:'6051f041-eac2-5d12-9a2f-8c90ad79e4bf',intent:{sliceId:'12323a0d-6c53-59fb-b18b-ecfac0936883',claimedClaimIds:['130d6e32-c0de-5753-920b-2eb7b3eea90d']}})
  assert.deepEqual(scoped.criteria.map(c=>c.evidence),['fail','missing'])
  assert.equal(scoped.evidenceCount,0)
  assert.deepEqual(scoped.artifacts.map(a=>a.id),['82dee788-b5c4-5cd1-ae62-9d2f00d39599'])
  assert.equal(scoped.reviews.length,1)
  assert.equal(evidenceForTurn(session,{id:'6051f041-eac2-5d12-9a2f-8c90ad79e4bf',intent:{sliceId:'886b091f-57f9-5f69-9e74-f0b50275d693'}}).criteria.length,1)
  assert.equal(session.criteria.length,4)
})
test('legacy turns require an explicit claim mapping rather than borrowing workstream proof',()=>{
  assert.equal(evidenceForTurn(session,{id:'6051f041-eac2-5d12-9a2f-8c90ad79e4bf',intent:{}}).criteria.length,0)
  assert.deepEqual(evidenceForTurn(session,{id:'6051f041-eac2-5d12-9a2f-8c90ad79e4bf',intent:{claimedClaimIds:['c5626d80-946d-500e-966e-02c68507b4f8']}}).criteria.map(c=>c.evidence),['fail'])
})
test('historical completion is not a current passing verdict',()=>{
  assert.match(completionLabel('done',false),/earlier.*needs attention/)
  assert.equal(completionLabel('done',true),'Complete')
  assert.notEqual(completionLabel('done',false),'Complete')
  assert.equal(completionLabel('active',true),null)
  assert.equal(completionLabel('active',false),null)
})
test('actual Git histories attribute only exact trailers, never close HEAD or prefix/body mentions',()=>{
 const root=mkdtempSync(join(tmpdir(),'sl-turn-git-'))
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'})
 try {
  git('init','-q');git('config','user.email','test@example.invalid');git('config','user.name','Test')
  const commit=message=>{git('commit','--allow-empty','-qm',message);return git('rev-parse','HEAD').trim()}
  commit('Previous turn\n\nSL-Turn: 1439c83d-8822-5496-b4dd-8e2e1fc2d30c')
  const correct=commit('Show activity\n\nSL-Turn: 6051f041-eac2-5d12-9a2f-8c90ad79e4bf')
  commit('Other turn\n\nSL-Turn: 600481ec-6dfa-509c-be96-447044ea2823')
  commit('Mention only\n\nSL-Turn: 6051f041-eac2-5d12-9a2f-8c90ad79e4bf\nThis prose prevents a trailer block.')
  const {readTurnCommit}=load('./git.ts',{'@/lib/ledger':{ledgerRootDir:()=>root}})
  assert.equal(readTurnCommit('6051f041-eac2-5d12-9a2f-8c90ad79e4bf')?.sha,correct)
  assert.equal(readTurnCommit('7fcd03d6-8030-558c-a719-9f55022be93d'),null)
  assert.equal(readTurnCommit('--all'),null)
 } finally {rmSync(root,{recursive:true,force:true})}
})
test('rendered change page puts evidence before collapsed commit and documents',()=>{
 const React=require('react');const {renderToStaticMarkup}=require('react-dom/server')
 const tag=name=>({children})=>React.createElement('div',{'data-section':name},children)
 const {TurnDetail}=load('../components/turn-detail.tsx',{
  '@/components/turn-evidence':{TurnEvidence:tag('evidence')},'@/lib/features':{presentationCopy:x=>x,featureHref:()=>'',featureLabel:x=>x,featureSlug:x=>x},
  'next/link':tag('link'),'@nessalabs/ui':Object.fromEntries(['Badge','Card','CardContent','CardDescription','CardHeader','CardTitle'].map(k=>[k,tag(k)])),
  '@/components/static-mermaid':{StaticMermaid:tag('chart')},'@/components/turn-files':{TurnFilesCard:tag('files')},'@/components/turn-doc-split':{RelatedDocsList:tag('docs')},'@/components/turn-plan-section':{TurnPlanSection:tag('plan')},'@/components/compact-turn-row':{CompactTurnRow:tag('row')},'@/components/freshness-badge':{FreshnessBadge:tag('freshness'),TurnVerifyBadge:tag('verify')},
  '@/lib/impact':{formatWhen:()=>'',humanStatus:x=>x,turnImpactSummary:()=>({product:[],features:[],nodes:[],claims:[],blastDirect:[]})},'@/lib/turns':{turnFreshness:()=> 'fresh'}
 })
 const html=renderToStaticMarkup(React.createElement(TurnDetail,{turn:{id:'6051f041-eac2-5d12-9a2f-8c90ad79e4bf',status:'closed',intent:{restatedGoal:'See activity'}},evidence:{session},commit:{subject:'Internal commit',short:'123',body:'SL-Turn: 6051f041-eac2-5d12-9a2f-8c90ad79e4bf'},relatedDocs:[{path:'DESIGN.md',label:'Architecture'}]}))
 assert.ok(html.indexOf('data-section="evidence"')<html.indexOf('Technical details'))
 assert.match(html,/<details[^>]*><summary[^>]*>Technical details/)
 assert.ok(html.indexOf('Technical details')<html.indexOf('Internal commit'))
 assert.ok(html.indexOf('Technical details')<html.indexOf('data-section="docs"'))
})
