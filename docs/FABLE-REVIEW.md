# Fable 5.1 design review (2026-09-02)

Adversarial review of the initial Spec Ledger architecture before scaffold.
Full verdict: **ship-with-changes**.

## Applied to this repo

| Feedback | How we applied it |
| --- | --- |
| Collapse packages | One implementable core `@nessa/spec-ledger`; client/server/ui are thin |
| Schemas as files | `schemas/` not a package |
| Binding ≠ result | Bindings have no status; outcomes only on results/report |
| Provenance digests | Report carries `ledgerDigest` + `resultsDigest` |
| `attested` ≠ `pass` | Required+attested fails verify in v1 |
| Results-file seam | `schemas/results.json` — language-agnostic |
| Server read-only | Only GET routes; 405 on writes (SL-003) |
| Client = embed gateway | `createSpecLedgerClient(inProcess \| http)` |
| Defer UI gravity | Reference UI is text Lattice; web UI later |
| Avoid `@ledger` name | `@nessa/spec-ledger*`, on-disk `.spec-ledger/` |

## Hardest invariant (quoted)

> A verify verdict is a pure function of (ledger files, source tree, ingested results) and carries the digest of those inputs; nothing else may produce `pass`.
