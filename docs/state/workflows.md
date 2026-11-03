---
id: "sl-workflows"
title: "Follow workflow steps"
kind: "guide"
status: "implemented"
summary: "A workflow describes ordered stages, steps and the typed outputs they require. Starting a step or reporting it complete does not create its evidence automatically."
parent: "sl"
sources:
  [
    "packages/ledger/src/workflows/index.ts",
    "packages/ledger/src/workflows/types.ts",
    "packages/ledger/src/application/operations.ts",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Follow a method without inventing outputs

A workflow describes ordered stages, steps and the typed outputs they require. Starting a step or reporting it complete does not create its evidence automatically.

Select and preserve a resolved workflow for the current workstream revision. An attempt names that snapshot, stage and step. Earlier required stages must be satisfied before later work becomes ready. Retrying an existing step requires a reason; old attempts remain history.

Link actual records as outputs: a spec revision, review, implementation report or check result must meet the selected step's contract and current identities. For most output kinds, records must have been produced after the attempt began. A reported-complete attempt with missing/stale outputs is not a satisfied step. Blocked and not-applicable remain different outcomes.

Changing the plan or selected snapshot can make old outputs inapplicable. Inspect the projected workflow and its blockers; a client must not infer satisfaction from the existence of a report alone. The workflow engine does not invoke an agent or automatically run the named skill.
