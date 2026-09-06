import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = createRequire(new URL('../../ledger/package.json', import.meta.url))('typescript')
const cache = new Map()
export function presentationRequire(id, fallback = require) {
 const files = {'@/components/readable-text':'../components/readable-text.tsx','@/lib/record-labels':'./record-labels.ts'}
 if (!files[id]) return fallback(id)
 if (cache.has(id)) return cache.get(id)
 const compiled = ts.transpileModule(readFileSync(new URL(files[id], import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
 const module = {exports:{}}
 new Function('require','module','exports',compiled)(name=>presentationRequire(name,fallback),module,module.exports)
 cache.set(id,module.exports)
 return module.exports
}
