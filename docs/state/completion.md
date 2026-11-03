---
id: "sl-completion"
title: "Check completion"
kind: "guide"
status: "implemented"
summary: "A requirement is done only when current implementation reporting and current behavioral evidence agree. A count of passing checks is not enough to complete the workstream."
parent: "sl"
sources:
  [
    "packages/ledger/src/session/project.ts",
    "packages/ledger/src/session/evidence.ts",
    "packages/ledger/src/deferrals/index.ts",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Tell reported progress from completion

A requirement is done only when current implementation reporting and current behavioral evidence agree. A count of passing checks is not enough to complete the workstream.

For example, a source file can exist and its path binding can pass, while the acceptance requirement has no behavioral result. The session projection keeps that requirement's evidence missing. An agent's implemented=true report is separately bound to the plan and source versions; later changes can make it historical.

Completion also requires current permission, an unchanged preserved plan, no open turns, no unresolved blocking findings, required spec/code reviews, affected deferred commitments, required screenshots and any selected workflow's current outputs. The completion checklist shows these independently. Read the named blockers rather than treating the first green section as permission to mark done.

The explicit complete operation activates and checks affected commitments, evaluates the shared session gate and only then writes done. Merely opening the UI or reading session state does not complete work. A workstream can be closed historically and still have evidence that is no longer current after the repository changes.

This atlas's documentation work records a turn and reviews, but does not mint product claims simply to force its own acceptance dashboard green. Any unmapped acceptance evidence remains visible as a limitation of that ledger projection.
