---
id: "sl-plans"
title: "Preserve a plan before work"
kind: "guide"
status: "implemented"
summary: "A workstream groups one outcome and its independently checkable slices. Creating a draft records a proposal; it does not authorize implementation or prove the outcome exists."
parent: "sl"
sources:
  [
    "packages/ledger/src/identity/creation.ts",
    "packages/ledger/src/workstream/load.ts",
    "packages/ledger/src/workstream/doc-digest.ts",
    "packages/ledger/src/context/vertical.ts",
    "packages/ledger/src/permission/authority.ts",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Preserve a plan before work

A workstream groups one outcome and its independently checkable slices. Creating a draft records a proposal; it does not authorize implementation or prove the outcome exists.

Write a short goal, acceptance conditions, feature scope and meaningful slice boundaries. Spec Ledger generates workstream and slice identities. A spec document supplies the human explanation, while its record carries the exact fields used by gates. Existing feature IDs must be in the graph.

A separate spec review examines the current revision. Under applicable permission, beginning work preserves a reproducible snapshot. Editing the plan or linked document changes its fingerprint; old approval/evidence must not be treated as current automatically. Read plan/context to see the next missing prerequisite. Reading does not create a new snapshot.

A legacy seal is retained for compatibility and is not authenticated consent. Delegated snapshots identify their permission record. Do not hand-write tool digests or pretend a review is a human decision. Proposed claims remain separate from live claims until the authorized builder creates the required records.

The historical work-model document contains older human-seal-only language. Its opening points to current permission, evidence, session and deferral contracts; the implementation of those owners is the checkpoint used by this atlas.
