import { presentationRequire } from './presentation-test-support.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url), ts = createRequire(new URL('../../ledger/package.json', import.meta.url))('typescript')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
function compile(path, overrides = {}) { const module = { exports: {} }; const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText; new Function('require', 'module', 'exports', output)(id => overrides[id] ?? presentationRequire(id, require), module, module.exports); return module.exports }
const Box=({children})=>React.createElement('div',null,children)
const ui={Button:({children,onClick,variant,...props})=>React.createElement('button',props,children),Input:props=>React.createElement('input',props),Checkbox:props=>React.createElement('input',{type:'checkbox',...props}),DropdownMenu:Box,DropdownMenuTrigger:Box,DropdownMenuContent:Box,DropdownMenuRadioGroup:Box,DropdownMenuRadioItem:Box}
const profile={id:'team',title:'Team workflow',stages:[{id:'build',title:'Build it',role:'implement',steps:[{id:'implement',title:'Implement',skill:'spec-ledger/implement',outputs:[{kind:'implementation-report'}]}]},{id:'test',title:'Test it',role:'verify',steps:[{id:'verify',title:'Verify',skill:'spec-ledger/verify',outputs:[{kind:'check-results'}]}]}]}

function nodes(node,p){if(!node||typeof node!=='object')return [];return [...(p(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(n=>nodes(n,p))]}
Object.assign(ui,{Drawer:({open,children})=>open?React.createElement('aside',null,children):null})
for(const name of ['DrawerContent','DrawerHeader','DrawerTitle','DrawerDescription','DrawerBody','WorkflowCanvas','WorkflowCanvasGrid','WorkflowCanvasSurface','WorkflowCanvasNode','WorkflowCanvasEdges','WorkflowCanvasEdge'])ui[name]=Box
test('canvas opens only the selected stage drawer and closing restores the full canvas without mutating or executing',()=>{
 let calls=0,cursor=0,state=[]
 const {WorkflowEditor}=compile('../components/workflow-editor.tsx',{'react':{...React,useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>state[i]=value]}},'@/lib/workflow-api':{previewWorkflow:()=>{calls++;throw Error('unexpected preview')}},'@nessalabs/ui':ui,'lucide-react':{ChevronDown:()=>null}})
 const render=(disabled=false)=>{cursor=0;return WorkflowEditor({initialProfile:profile,options:{defaultProfile:profile,localSkills:[],truncated:false},disabled,saveMessage:'Version conflict: refresh before saving',onSave:()=>{calls++},onCancel:()=>{}})}
 let tree=render(),html=renderToStaticMarkup(tree)
 assert.match(html,/Define a saved workflow/);assert.ok(html.indexOf('1. Build it')<html.indexOf('2. Test it'))
 assert.doesNotMatch(html,/What must this step produce/);assert.match(html,/Preview workflow/);assert.doesNotMatch(html,/Apply workflow|Use this workflow/)
 const stageButton=n=>n.type==='button'&&n.props['aria-pressed']!==undefined
 nodes(tree,stageButton)[1].props.onClick();tree=render();html=renderToStaticMarkup(tree)
 assert.match(html,/What must this step produce/);assert.match(html,/Implementation report/);assert.match(html,/Passing tests/)
 const drawers=nodes(tree,n=>n.type===ui.Drawer);assert.equal(drawers[0].props.open,true);assert.equal(drawers[1].props.open,false)
 const stageFields=nodes(drawers[0],n=>n.type===ui.Input&&n.props.value==='Test it');assert.equal(stageFields.length,1)
 assert.equal(nodes(drawers[0],n=>n.type===ui.Input&&n.props.value==='Build it').length,0)
 drawers[0].props.onOpenChange(false);tree=render();assert.doesNotMatch(renderToStaticMarkup(tree),/What must this step produce/)
 const blocked=render(true);assert.ok(nodes(blocked,stageButton).every(n=>n.props.disabled));assert.equal(nodes(blocked,n=>n.props.children==='Add stage')[0].props.disabled,true)
 state[3]={preview:{profile:{title:profile.title},stages:profile.stages.map(stage=>({...stage,steps:stage.steps.map(step=>({...step,skill:{content:'Bundled guidance'}}))}))}}
 tree=render();const previewDrawer=nodes(tree,n=>n.type===ui.Drawer)[2]
 assert.equal(previewDrawer.props.open,true);assert.match(renderToStaticMarkup(previewDrawer),/Version conflict: refresh before saving/)
 assert.equal(calls,0)
})
