# Workstreams

Start here to find a spec. Each new workstream has one folder containing its main spec and any supporting material. Machine-readable state, formal reviews, and seals remain in `.spec-ledger/`; `specPath` identifies the main document.

## Current work

| Workstream | Main spec | Supporting material |
| --- | --- | --- |
| ef172105-4f40-8bbb-8abe-d1cd11ae618a · Name a workflow once and reuse it | [Read the spec](ef172105-4f40-8bbb-8abe-d1cd11ae618a-named-workflows/spec.md) | Shaped; not yet sealed |
| 815c7a44-59df-8102-9769-bf8a74e49c0c · Guide agents and follow verified work | [Read the spec](815c7a44-59df-8102-9769-bf8a74e49c0c-shared-agent-workflows/spec.md) | [Shared CLI/MCP and workflow proposal](../proposals/customizable-engineering-workflows.md) |
| 1652e353-e3dc-8960-985b-35fbe40c1edb · Review evidence in one place | [Read the spec](1652e353-e3dc-8960-985b-35fbe40c1edb-evidence-and-custom-workflows/spec.md) | Evidence beside the spec |
| a32f3451-1b3d-8abf-bf0e-607ebf6e1a88 · Trustworthy autonomous coding | [Read the proposal](a32f3451-1b3d-8abf-bf0e-607ebf6e1a88-trustworthy-autonomous-coding/spec.md) | [Initial review evidence](a32f3451-1b3d-8abf-bf0e-607ebf6e1a88-trustworthy-autonomous-coding/review-notes.md) — historical observations, not another spec |
| d1be55a6-11bb-8460-8650-ddf0ecac8185 · Consumer CLI, npm publish, sealed plan digests | [Read the spec](consumer-cli-and-npm-publish.md) | Formal reviews in [the ledger](../../.spec-ledger/reviews/workstreams/d1be55a6-11bb-8460-8650-ddf0ecac8185/) |

## Earlier work

| Workstream | Main spec |
| --- | --- |
| 76451749-a54f-8579-96f2-dcec19d79026 · Spec and code stay coupled | [Read the spec](spec-code-coupling-and-honest-lattice-trail.md) |
| beee03a2-1e8d-8091-9ed9-b35bea93d6a3 · Spec Ledger in the browser | [Read the spec](spec-ledger-dogfood-ui.md) |
| e6213c3f-60e4-8ceb-9d6a-15c67833b383 · Full builder runtime | [Read the spec](p0-p3-runtime-and-dogfood.md) |
| 3317ada5-b347-894e-8c88-110b7b42d58b · Honest builder turns | [Read the spec](builder-episode-loop.md) |

For live status, use the UI or [workstream metadata](../../.spec-ledger/workstreams/). This index does not duplicate workflow status.

## Layout for new work

```text
docs/workstreams/
  README.md
  a32f3451-1b3d-8abf-bf0e-607ebf6e1a88-trustworthy-autonomous-coding/
    spec.md             # Main proposal and acceptance; read this first
    review-notes.md     # Optional supporting evidence, clearly labeled
    assets/             # Only when images or other files are needed
```

- Folder name: stable workstream ID plus a readable slug. Do not rename it for routine title changes.
- `spec.md` is the one main spec. Link supporting material from it; avoid alternate spec copies such as `spec-final-v2.md`.
- Create supporting files only when needed. They provide evidence or explanation, not a competing acceptance contract. Formal review records remain in `.spec-ledger/reviews/`.
- Shared architecture belongs in [architecture](../architecture/); standing vision belongs in [compass](../compass/). Keep workstream-specific research beside its spec.
- New work uses this layout. 3317ada5-b347-894e-8c88-110b7b42d58b–d1be55a6-11bb-8460-8650-ddf0ecac8185 retain their existing sealed paths. Move sealed documents only through an explicit recorded migration; never silently rewrite snapshots or facts.

This layout supersedes the earlier flat title-slug naming convention for new workstreams. It does not retroactively amend older sealed specs.

- [Follow agent experiments](29c935b4-56bd-84a0-b887-e280d775f54d-follow-agent-experiments/spec.md)
