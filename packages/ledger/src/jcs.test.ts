import assert from "node:assert/strict"
import { test } from "node:test"
import { jcsCanonicalize } from "./jcs.js"
import { sha256Stable } from "./fs/load.js"

test("RFC 8785 JCS key order", () => {
  assert.equal(jcsCanonicalize({ b: 2, a: 1 }), '{"a":1,"b":2}')
  assert.equal(
    jcsCanonicalize({ z: 1, a: { y: 0, x: 9 } }),
    '{"a":{"x":9,"y":0},"z":1}',
  )
})

test("sha256Stable is stable under key permutation", () => {
  assert.equal(sha256Stable({ a: 1, b: 2 }), sha256Stable({ b: 2, a: 1 }))
  assert.equal(sha256Stable({ a: 1 }).length, 64)
})
