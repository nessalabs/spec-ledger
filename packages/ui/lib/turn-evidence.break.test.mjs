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
  new Function('require','module','exports',compiled)(id=>id in overrides?overrides[id]:require(id),module,module.exports)
  return module.exports
}
const {evidenceForTurn,completionLabel}=load('./turn-evidence.ts')
const criterion=(id,evidence,claim)=>({id,evidence,claims:[{id:claim}]})
const session={criteria:[criterion('SLC-01/AC-01','pass','SL-01'),criterion('SLC-010/AC-01','pass','SL-10'),criterion('SLC-02/AC-01','fail','SL-02'),criterion('SLC-02/AC-02','missing','SL-03')],reviews:[{turnId:'T-036'},{turnId:'T-035'}],artifacts:[{turnId:'T-036',id:'own'},{turnId:'T-035',id:'other'}],evidenceCount:2}
test('turn evidence excludes adjacent slice prefixes and preserves failed/missing verdicts',()=>{
  const scoped=evidenceForTurn(session,{id:'T-036',intent:{sliceId:'SLC-02',claimedClaimIds:['SL-01']}})
  assert.deepEqual(scoped.criteria.map(c=>c.evidence),['fail','missing'])
  assert.equal(scoped.evidenceCount,0)
  assert.deepEqual(scoped.artifacts.map(a=>a.id),['own'])
  assert.equal(scoped.reviews.length,1)
  assert.equal(evidenceForTurn(session,{id:'T-036',intent:{sliceId:'SLC-01'}}).criteria.length,1)
  assert.equal(session.criteria.length,4)
})
test('legacy turns require an explicit claim mapping rather than borrowing workstream proof',()=>{
  assert.equal(evidenceForTurn(session,{id:'T-036',intent:{}}).criteria.length,0)
  assert.deepEqual(evidenceForTurn(session,{id:'T-036',intent:{claimedClaimIds:['SL-02']}}).criteria.map(c=>c.evidence),['fail'])
})
test('historical completion is not a current passing verdict',()=>{
  assert.match(completionLabel('done',false),/earlier.*needs attention/)
  assert.match(completionLabel('done',true),/current checks satisfied/)
  assert.equal(completionLabel('active',false),null)
})
test('actual Git histories attribute only exact trailers, never close HEAD or prefix/body mentions',()=>{
 const root=mkdtempSync(join(tmpdir(),'sl-turn-git-'))
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'})
 try {
  git('init','-q');git('config','user.email','test@example.invalid');git('config','user.name','Test')
  const commit=message=>{git('commit','--allow-empty','-qm',message);return git('rev-parse','HEAD').trim()}
  commit('Previous turn\n\nSL-Turn: T-035')
  const correct=commit('Show activity\n\nSL-Turn: T-036')
  commit('Other turn\n\nSL-Turn: T-0360')
  commit('Mention only\n\nSL-Turn: T-036\nThis prose prevents a trailer block.')
  const {readTurnCommit}=load('./git.ts',{'@/lib/ledger':{ledgerRootDir:()=>root}})
  assert.equal(readTurnCommit('T-036')?.sha,correct)
  assert.equal(readTurnCommit('T-999'),null)
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
 const html=renderToStaticMarkup(React.createElement(TurnDetail,{turn:{id:'T-036',status:'closed',intent:{restatedGoal:'See activity'}},evidence:{session},commit:{subject:'Internal commit',short:'123',body:'SL-Turn: T-036'},relatedDocs:[{path:'DESIGN.md',label:'Architecture'}]}))
 assert.ok(html.indexOf('data-section="evidence"')<html.indexOf('Technical details'))
 assert.match(html,/<details[^>]*><summary[^>]*>Technical details/)
 assert.ok(html.indexOf('Technical details')<html.indexOf('Internal commit'))
 assert.ok(html.indexOf('Technical details')<html.indexOf('data-section="docs"'))
})
