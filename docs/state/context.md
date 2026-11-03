---
id: "sl-context"
title: "Read current context"
kind: "guide"
status: "implemented"
summary: "Context combines the preserved plan with relevant claims, structure, prior decisions and applicable guidance. It gives an agent information to reason with; it does not replace permission or evidence gates."
parent: "sl"
sources:
  [
    "packages/ledger/src/context/vertical.ts",
    "packages/ledger/src/related/pack.ts",
    "packages/ledger/src/compass/learnings.ts",
    "packages/ledger/src/compass/load.ts",
    "packages/ledger/src/automation/load.ts",
    "packages/ledger/src/episodes/load.ts",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Find decisions and current guidance

Context combines the preserved plan with relevant claims, structure, prior decisions and applicable guidance. It gives an agent information to reason with; it does not replace permission or evidence gates.

Vision and tenets express standing judgment. Learnings record attributed corrections. Scoped user-reported corrections enter active context; agent-inferred preferences remain unconfirmed. Supersession removes old guidance only within the scope where it applies. The context digest covers contents, not just record IDs.

Related-work packs find nearby ledger material and may provide caution about sibling worktrees. They do not merge that work or grant authority over another checkout. Episode sources and attachments explain where a decision came from; their presence does not create pass evidence.

Automation events record waiting/blocked/resolved states. Explicit context/open paths can apply a configured wait timeout, but the resulting workflow decision does not expand the user's authority or dispatch a host action. Reads, resumption transitions and external execution must remain distinct.
