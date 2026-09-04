# Initial review evidence

Companion to [Trustworthy autonomous coding](spec.md). These are historical observations from the initial September 4 review, not a current defect inventory. The checkout has changed during this discussion, including W-005 implementation. Revalidate each finding before scheduling a fix; do not treat the old counts or line numbers as current.

## Findings at initial inspection


Paths below are relative to the repository. Reproduced findings used temporary fixtures and the existing built CLI/library; the remaining findings are source inspection.

| Finding | Evidence | Consequence |
| --- | --- | --- |
| All eight dogfood bindings check file existence | `.spec-ledger/bindings/b-sl-001.json` through `b-sl-008.json` | Green currently does not establish the behavior described by those claims. |
| A passing results row can hide a later failing binding | `packages/ledger/src/verify/verify.ts:66–75`; reproduced with one pass and one fail | The claim verdict depends on binding order. |
| Old results remain accepted after source changes | `packages/ledger/src/verify/verify.ts:109–129`; reproduced with obsolete results and changed source | Ledger/results hashes and a current commit label do not prove that checks ran on the current tree. |
| A valid old coverage waiver can cover newly added files | `packages/ledger/src/align/check.ts:143–145`; reproduced with a new uncovered `rogue.ts` | A previous approval can incorrectly authorize today's coverage state. |
| GET handlers can execute commands or write files | `packages/server/src/routes.ts`, `packages/ledger/src/fs/snapshot.ts`, `packages/ledger/src/verify/verify.ts`, `packages/ledger/src/context/vertical.ts:131` | GET-only transport does not enforce the claimed read-only boundary. |
| Current context still requires a sealed workstream | `packages/ledger/src/context/vertical.ts:65`, `skills/sl-dev-build/SKILL.md` | Delegated authority is not a first-class supported path. |
| Context hashes tenet/claim IDs rather than their contents | `packages/ledger/src/context/vertical.ts:42–53` | An instruction can change without changing its context fingerprint. |
| Snapshot checking compares stored hash labels without hashing snapshot content | `packages/ledger/src/workstream/load.ts:130–142` | A changed snapshot body can escape this check. The human-readable Markdown is not presently included; W-005 already proposes that addition. |
| Corrections are described more fully than implemented | `skills/sl-learn/SKILL.md`, `packages/ledger/src/compass/load.ts`, `packages/ledger/src/types.ts` | Learnings lack a complete typed storage/context/CLI loop. |
| The UI conflates freshness and success | `packages/ui/lib/turns.ts:10–14`, `packages/ui/components/freshness-badge.tsx` | Matching ledger metadata can leave a historical success looking current despite changed evidence. |
| The overview is a record browser rather than a live session | `packages/ui/app/page.tsx:24–29`, `packages/ui/app/workstreams/[id]/page.tsx` | It selects one open turn and one latest workstream; linked turns can be called shipped before closure; no live refresh loop was found. |

These findings do not mean every feature needs replacement. They identify the smallest gaps between the product promise and the implementation.

## Validation at initial inspection


On the inspected checkout, the existing built CLI returned verify OK (8 path-based passes), audit OK (2 informational waivers), and align OK while listing 53 uncovered paths as waived/approved. Those results demonstrate current behavior, not acceptance of this proposal or proof that the identified gaps are harmless. The old-waiver fixture explains why the align result needs caution. A fresh build/test result is recorded separately in the accompanying review response.

Available validation: direct TypeScript checks passed for ledger, client, and server; the existing compiled test suite passed 37/37 tests. The requested pnpm build/test chain could not bootstrap pnpm 9.15.0 because registry fetch/signature verification failed. Therefore these are not claimed as a successful fresh full build or UI build. A separate read-only critique of this draft led to the narrower first vertical, explicit denial semantics, freshness observation rules, and single-source acceptance above.

Planning-only verification receipt (no implementing turn opened or closed):

```text
spec-ledger: OK (existing verifier, limitations above)
turn: (none)
workstream: W-006 (draft)
contextDigest: none
ledgerDigest: e3bfc18575b2690636be99ac220c48385d1920ae375a2340cdf9223d71013bc7
resultsDigest: ded3eb2608a70a2e28040c5e1e7c4faa49be0d27b4ffc4d3e2a3ffb91bf72fbb
commit: 87d318701ebb987cd67babaeda38f6bf316d517f
```
