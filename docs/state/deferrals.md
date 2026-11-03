---
id: "sl-deferrals"
title: "Revisit work that was deferred"
kind: "guide"
status: "implemented"
summary: "A deferred commitment records what must be revisited when a named feature is worked on. It is not an optional note that can disappear when its original decision is deleted."
parent: "sl"
sources:
  [
    "packages/ledger/src/deferrals/index.ts",
    "packages/ledger/src/session/project.ts",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Revisit work that was deferred

A deferred commitment records what must be revisited when a named feature is worked on. It is not an optional note that can disappear when its original decision is deleted.

The explicit work transition preserves an activation snapshot for affected commitments. Reads evaluate current obligations without creating activations. An edited or missing activated source decision becomes unknown; the saved commitment remains available and blocks an unsupported completion.

An implement commitment needs current passing behavioral evidence for its requirement. File presence or attestation alone is insufficient. A revisit commitment needs an authorized recorded decision tied to current permission and revision. Re-deferring requires a new linked commitment; hard implementation requirements cannot be dismissed through that route.

The backlog projection also lists candidate workstreams. External discovery is not configured at this checkpoint. It does not search remote issue trackers or autonomously authorize the next task.
