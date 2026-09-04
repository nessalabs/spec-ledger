# Vision — Spec Ledger

**Metadata:** [`.spec-ledger/vision.json`](../../.spec-ledger/vision.json) · standing compass (not a workstream)

---

## Summary

Spec Ledger makes automated coding trustworthy: agents implement from sealed context, and humans can see how the product evolved and why — so changing X cannot silently break Y.

## North star

A verify verdict is a pure function of ledger + tree + results; episodes and compass never invent pass. Quality bar: library/staging first, correctness-critical digests, cheap next change over clever now.

## Non-goals

- AST graph extraction
- Multi-tenant SaaS
- Server write APIs
- Inventing pass outside verify

## Users

- Humans reviewing agent work in Spec Ledger UI
- Coding agents that must not invent pass
- Embedders on `@nessalabs/spec-ledger-client`
