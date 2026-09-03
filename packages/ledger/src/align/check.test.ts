import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { pathMatchesPattern, isExemptPath } from "./paths.js"
import { checkPathCoverage, locatorsForFeatures } from "./coverage.js"
import type { CodebaseGraph } from "../types.js"

const graph: CodebaseGraph = {
  system: { name: "t", description: "test", revision: "1" },
  layers: [],
  features: [],
  nodes: [
    {
      id: "ledger-core",
      name: "core",
      layer: "core",
      kind: "package",
      locator: "packages/ledger",
      featureIds: ["turns", "verify"],
    },
    {
      id: "ledger-ui",
      name: "ui",
      layer: "ui",
      kind: "package",
      locator: "packages/ui",
      featureIds: ["lattice"],
    },
  ],
  edges: [],
}

describe("align paths", () => {
  it("matches locator prefixes and /** globs", () => {
    assert.equal(pathMatchesPattern("packages/ledger/src/a.ts", "packages/ledger"), true)
    assert.equal(
      pathMatchesPattern("packages/ledger/src/align/x.ts", "packages/ledger/src/align/**"),
      true,
    )
    assert.equal(pathMatchesPattern("packages/ui/app/x.tsx", "packages/ledger"), false)
    assert.equal(isExemptPath(".spec-ledger/turns/T-001.json"), true)
    assert.equal(isExemptPath("packages/ui/.next/cache"), true)
  })
})

describe("align coverage", () => {
  it("covers via graph feature locators", () => {
    const r = checkPathCoverage({
      paths: [
        "packages/ledger/src/align/check.ts",
        ".spec-ledger/turns/T-001.json",
        "packages/client/src/index.ts",
      ],
      featureIds: ["turns"],
      graph,
    })
    assert.deepEqual(r.coveredPaths, ["packages/ledger/src/align/check.ts"])
    assert.deepEqual(r.uncoveredPaths, ["packages/client/src/index.ts"])
    assert.equal(r.coverageSource, "graph")
  })

  it("covers via expectedPaths when graph misses", () => {
    const r = checkPathCoverage({
      paths: ["schemas/workstream.json", "packages/ui/app/page.tsx"],
      featureIds: ["turns"],
      expectedPaths: ["schemas/workstream.json", "packages/ui/**"],
      graph,
    })
    assert.equal(r.uncoveredPaths.length, 0)
    assert.equal(r.coverageSource, "mixed")
  })

  it("locatorsForFeatures unions node locators", () => {
    assert.deepEqual(locatorsForFeatures(graph, ["lattice"]).sort(), [
      "packages/ui",
    ])
  })
})
