# Spec Ledger dogfood UI

**Workstream:** `W-003` · **Status:** done (retrofit pitch — prose extracted from metadata for human navigation)  
**Agent metadata:** [`.spec-ledger/workstreams/W-003.json`](../../.spec-ledger/workstreams/W-003.json)  
**Note:** Historical seal digests predate this Markdown; `specPath` is a live pointer only.

---

## Problem

The UI was a verify dashboard. Workstreams, open turns, and episode trails were not the hero — Spec Ledger did not feel like our own tool when opened in the browser.

## Objective

Read-only Spec Ledger UI: home = active bet + open turn + verify badge; `/workstreams` list+detail; turn pages show reviews/decisions/attachments metadata — dogfood this repo.

## Trust & policy

- Deploy: library-consumer · User-facing  
- Evidence: integration, e2e  
- Spec-break not required on this bet · code-break required  

## Acceptance

- `pnpm lattice` boots against this repo `.spec-ledger`  
- `/` shows workstream pulse + open turn or empty state + live verify badge  
- `/workstreams` and `/workstreams/[id]` show status, seal, slices, linked turns  
- `/turns/[id]` shows workstream/slice/contextDigest + reviews/decisions/attachments  
- Nav includes Workstreams; product chrome says Spec Ledger not Lattice  
- Client `listWorkstreams` / `getWorkstream` + turn episode helpers; UI uses client only  

## Out of scope

Write/mutate UI · media player / upload · compass edit · Spec Ledger UI in GitHub CI · new design system  

## Verticals

### SLC-01 — Client + workstream routes + home rewrite

- `listWorkstreams` / `getWorkstream` / `getTurnEpisode` on client+HTTP  
- Home + `/workstreams` + turn episode trail  
- Chrome branded Spec Ledger  
