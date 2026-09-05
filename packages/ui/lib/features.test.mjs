import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const ts = createRequire(new URL('../../ledger/package.json', import.meta.url))('typescript')

// Compile the actual dependency-free route helper so these tests run on supported Node 20.
const source = readFileSync(new URL('./features.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { featureHref, resolveFeatureId, presentationCopy } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('public UI route resolves the original graph feature and retains old inbound links', () => {
  const original = { id: 'lattice', claimIds: ['UI-001'] }
  const features = [original, { id: 'verify' }]
  assert.equal(featureHref(original.id, features), '/features/spec-ledger-ui')
  assert.equal(resolveFeatureId(features, 'spec-ledger-ui'), original)
  assert.equal(resolveFeatureId(features, 'lattice'), original)
  assert.equal(resolveFeatureId(features, 'unknown'), undefined)
})

test('a consumer feature with the public slug does not hijack the original feature link', () => {
  const original = { id: 'lattice' }
  const native = { id: 'spec-ledger-ui' }
  const features = [original, native]
  assert.equal(resolveFeatureId(features, 'spec-ledger-ui'), native)
  assert.equal(featureHref(original.id, features), '/features/lattice')
  assert.equal(resolveFeatureId(features, decodeURIComponent(featureHref(original.id, features).split('/').at(-1))), original)
  assert.equal(featureHref('billing/export?kind=all'), '/features/billing%2Fexport%3Fkind%3Dall')
})


test('historical display copy changes product prose without changing technical references', () => {
  const record = { title: 'Make Lattice lists readable.', path: 'docs/lattice.md', featureId: 'lattice' }
  assert.equal(presentationCopy(record.title), 'Make Spec Ledger UI lists readable.')
  assert.equal(presentationCopy('Read /features/lattice and `lattice`; see Lattice.'), 'Read /features/lattice and `lattice`; see Spec Ledger UI.')
  assert.deepEqual(record, { title: 'Make Lattice lists readable.', path: 'docs/lattice.md', featureId: 'lattice' })
})
