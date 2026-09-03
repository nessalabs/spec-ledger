# P0–P3 runtime + dogfood

**Workstream:** `W-002` · **Status:** done (retrofit pitch — prose extracted from metadata for human navigation)  
**Agent metadata:** [`.spec-ledger/workstreams/W-002.json`](../../.spec-ledger/workstreams/W-002.json)  
**Note:** Historical seal digests predate this Markdown; `specPath` is a live pointer only.

---

## Problem

The builder loop existed, but turn check/abandon, automation resume, HTTP context, related pack, episode side collections, audit/CI, and compass/timeline were missing — the product stopped at W-001.

## Objective

Ship remaining architecture through P3: turn ops + automation + HTTP context + related; themes/proposed-claims/compass/timeline; decisions/sources/attachments/probes/flows + basis; audit policy + CI; dogfood this repo under workstreams.

## Trust & policy

- Deploy: library-consumer · User-facing · Correctness-critical  
- Evidence: unit, integration, e2e  
- Spec-break optional on this bet · code-break required · alert high → wait 10m → move  

## Acceptance

- `turn check` recomputes facts without writing; `turn abandon` writes facts with status abandoned  
- Open stamps `treeDigest`; refuses dirty unless `--allow-dirty`  
- `GET /v1/context` returns `VerticalContext`; client HTTP path works  
- Automation events resume timeouts on context/open; close refuses blocked events  
- `spec-ledger related --workstream` returns claims/features/turns/docs pack  
- Decisions/sources/attachments/probes/flows loadable; decision basis stamped on close when present  
- `spec-ledger audit` + policy; CI runs verify + audit + test  
- Lattice `/compass` and `/timeline` render vision/tenets/turns  
- Proposed-claims dir + list; themes optional; dogfood turn under W-002  

## Out of scope

Full RFC 8785 JCS (kept `sha256Stable`) · write HTTP endpoints · compass editing UI · PR bot / merge queue · multi-repo federation  

## Verticals

### SLC-01 — Turn ops + HTTP context + automation + related

check/abandon/treeDigest/allow-dirty · `/v1/context` · automation resume · related pack  

### SLC-02 — Episode side collections + decision basis

Load decisions/sources/attachments/probes/flows · close stamps collection digests when present  

### SLC-03 — Audit + CI + Lattice compass/timeline + dogfood

Audit CLI + CI workflow · `/compass` `/timeline` · closed W-002 turn  
