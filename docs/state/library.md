---
id: "sl-library"
title: "Reuse a saved workflow"
kind: "guide"
status: "implemented"
summary: "A saved workflow is a reusable template. Adopting it copies its
  resolved content into a workstream snapshot; it does not leave the workstream
  following future edits to that template."
parent: "sl"
sources:
  [
    "packages/ledger/src/workflows/index.ts",
    "packages/ledger/src/workflows/local-ui.ts",
    "packages/ledger/src/application/operations.ts",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
model: { "spec": "tla/WorkflowCopy.tla", "config": "tla/WorkflowCopy.cfg" }
modelCheck:
  sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
  checker: tlc-1.7.4
  date: 2026-11-03T09:25:38.278Z
  config: tla/WorkflowCopy.cfg
  modelDigest: 24ee377c8d8c7ca9e71c0c0e7afce3d9e831da5ac6782a0b71dbfc7b8dd227f9
  states: 16
  held:
    - AdoptedCopyStable
    - VersionChecked
  broke: []
  unchecked: []
---

# Reuse a saved workflow

A saved workflow is a reusable template. Adopting it copies its resolved content into a workstream snapshot; it does not leave the workstream following future edits to that template.

For example, save a review method, adopt it into work A, then edit the library version for work B. Work A keeps its preserved method. To change A, explicitly amend its selected snapshot with the expected current digest and a reason.

Library updates and deletion require the version the caller read. A stale edit refuses; reread and reconcile instead of silently replacing another edit. The project default is a versioned selection pointer, not a command to rewrite adopted copies. Local browser operations use the shared engine through bounded adapters.

The bounded WorkflowCopy model explores two template versions, adoption, editing and stale update attempts. It checks that library changes preserve the adopted version and stale expected versions cannot authorize an update. It excludes method validation, disk publication and concurrent direct library calls outside cooperative application serialization.

These models check finite safety only; completed states allow stuttering and terminal deadlock checks are disabled. No eventual progress is claimed.
