import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url), ts = createRequire(new URL('../../ledger/package.json', import.meta.url))('typescript')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
function compile(path, overrides = {}) { const module = { exports: {} }; const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText; new Function('require', 'module', 'exports', output)(id => overrides[id] ?? require(id), module, module.exports); return module.exports }
const helpers = compile('./workflow-editor.ts')
test('import rejects malformed nested configuration before rendering but retains valid output scopes', () => {
 const profile = { id: 'team', title: 'Team', stages: [{ id: 'test', title: 'Test', role: 'verify', steps: [{ id: 'check', title: 'Check', skill: 'spec-ledger/verify', outputs: [{ kind: 'check-results', criterionIds: ['AC-1'] }] }] }] }
 assert.deepEqual(helpers.parseWorkflowDraft(JSON.stringify(profile)), profile)
 for (const value of [null, {}, {...profile, stages: [null]}, {...profile, stages: [{...profile.stages[0], role: 'made-up'}]}, {...profile, stages: [{...profile.stages[0], steps: [{...profile.stages[0].steps[0], outputs:[null]}]}]}]) assert.throws(() => helpers.parseWorkflowDraft(JSON.stringify(value)))
})
test('workflow editor starts collapsed and does not read or execute anything while rendering', () => {
 const oldFetch = globalThis.fetch; let calls = 0; globalThis.fetch = () => { calls++; throw Error('unexpected fetch') }
 try {
  const ui = new Proxy({}, {get: (_,key) => key === 'Button' ? ({children,onClick,...props}) => React.createElement('button',props,children) : () => null})
  const {WorkflowEditor} = compile('../components/workflow-editor.tsx', {'@/lib/workflow-editor': helpers, '@nessalabs/ui':ui, 'lucide-react':{ChevronDown:()=>null}})
  const html=renderToStaticMarkup(React.createElement(WorkflowEditor,{workstreamId:'W-001'})); assert.match(html,/Choose workflow/); assert.doesNotMatch(html,/Apply workflow/); assert.equal(calls,0)
 } finally { globalThis.fetch=oldFetch }
})
