---
id: "sl-turns"
title: "Record one implementation turn"
kind: "guide"
status: "implemented"
summary: "A turn records one episode of work: what was intended, what context was opened, decisions made, and what the tool observed at close. It is not the entire workstream."
parent: "sl"
sources:
  [
    "packages/ledger/src/turns/close.ts",
    "packages/ledger/src/turns/gates.ts",
    "packages/ledger/src/episodes/write.ts",
    "scripts/git-hooks/commit-msg",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Record one implementation turn

A turn records one episode of work: what was intended, what context was opened, decisions made, and what the tool observed at close. It is not the entire workstream.

Begin an authorized slice through the shared work operation. It records context and source checkpoints, then opens a turn. During that turn, add decisions, sources, probes, flows and attachments through their writers. These records explain the work; they do not turn a claim green by themselves.

Close checks permission, required visual evidence, review copy and unresolved blockers, current adversarial code review, applicable alignment and blocked automation events. If a gate refuses, keep the turn open while correcting the named condition. Never hand-edit facts to make it look closed. Abandoning records that the episode ended without representing successful completion; there is no reopen operation.

The close tool derives files and touched features/claims from git and computes evidence digests. A SL-Turn commit trailer connects commits to this episode even if a later rebase changes commit IDs. A closed turn's source facts can become historical after later edits. Closing a turn is not completing every acceptance condition in its workstream.
