---
id: "sl-reviews"
title: "Resolve review findings"
kind: "guide"
status: "implemented"
summary: "A review records an independent judgment and its evidence. Resolve a finding with a new review that names what it resolves; rewriting the original hides the history readers need."
parent: "sl"
sources:
  [
    "packages/ledger/src/reviews/load.ts",
    "packages/ledger/src/reviews/lattice-copy.ts",
    "packages/ledger/src/align/check.ts",
    "packages/ledger/src/align/approve.ts",
    "packages/ledger/src/align/coverage.ts",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Resolve findings without erasing them

A review records an independent judgment and its evidence. Resolve a finding with a new review that names what it resolves; rewriting the original hides the history readers need.

A code-break approval must contain the required adversarial evidence and match current source. A comment or an empty approval does not satisfy the gate. Blocking findings remain blocking until their referenced resolutions are accepted. Review summaries have plain reader-facing text as well as technical detail, so a person can understand the consequence before reading paths and test names.

Alignment is a separate path-coverage check: it asks whether changed product files fit the planned scope. It does not establish test correctness and does not change verify.ok. Where policy requires alignment approval, use the owning approval operation with the required intent/evidence, rather than changing an unrelated claim result.

For example, fixing a rejected retry rule changes source. The previous code approval may now be stale; rerun affected checks and obtain current review evidence before closing. A documentation-only correction still needs its applicable repository checks, but must not claim runtime behavior changed.
