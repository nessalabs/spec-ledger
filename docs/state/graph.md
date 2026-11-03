---
id: "sl-graph"
title: "Read the structural map"
kind: "guide"
status: "implemented"
summary: "The graph describes features, modules, dependencies and source locators. It helps find the affected neighborhood of a change; it does not decide whether a behavioral claim passed."
parent: "sl"
sources:
  [
    "packages/ledger/src/graph/impact.ts",
    "packages/ledger/src/verify/verify.ts",
    "packages/client/src/graph-shape.ts",
    "packages/ui/app/graph/page.tsx",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Read the structural map

The graph describes features, modules, dependencies and source locators. It helps find the affected neighborhood of a change; it does not decide whether a behavioral claim passed.

Impact follows graph edges to report direct and transitive neighbors. Layer rules expose forbidden dependency relationships. Locator checks confirm that named paths exist, not that the graph perfectly captures every import or runtime call. The graph is authored data at this checkpoint; automatic AST extraction is not implemented.

Claims can be linked to nodes and features so turn facts and history can be navigated by responsibility. Keep IDs and locators current when files move. A stale graph endpoint or missing path can fail the report even while individual command results remain passing.

The reference UI exposes feature/module details and Mermaid structural views. Those diagrams are projections of stored records, not execution traces.
