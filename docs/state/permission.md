---
id: "sl-permission"
title: "Know which work is allowed"
kind: "guide"
status: "implemented"
summary: "Permission is a recorded scope for future ledger transitions. Intent describes desired work; evidence describes observed results. Neither automatically grants permission."
parent: "sl"
sources:
  [
    "packages/ledger/src/permission/authority.ts",
    "packages/ledger/src/permission/local-ui.ts",
    "packages/ledger/src/application/operations.ts",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Know which work is allowed

Permission is a recorded scope for future ledger transitions. Intent describes desired work; evidence describes observed results. Neither automatically grants permission.

For example, a request delegation can authorize changes within named features. It cannot override an exclusion or an explicit denial by rewriting the plan. Revision approval instead names one exact plan fingerprint; changing that plan requires current authority for the new revision.

The authority owner evaluates revision, request and standing grants, revocation, restrictions and denial. A request-specific grant prevents silent fallback to broader standing permission. Records are append-only; revocation preserves history. Existing legacy seals remain a compatibility path labeled unverified.

## A saved decision is not authenticated identity

CLI permission sources are agent-reported provenance. The local browser approval adapter requires loopback/same-origin/token checks and a current plan and authority fingerprint. It accepts bounded revision approve/deny actions, not arbitrary standing delegation. Its source still says identity is not authenticated. Repeating the same compatible request can reconcile a lost reply; a conflict requires reading current state.

Work entry preserves an executable plan only after current permission and required spec review. Completion and turn close check permission again. Revocation cannot undo a command already running outside the ledger. It prevents later dependent transitions; use the actual process/provider owner to address external work.

Permission remains a source-reviewed contract here, not a claim that a small Boolean model proves all grant precedence and filesystem races. See [operation receipts](operations.md) for uncertain writes.
