# Spec Ledger skills

Prefix: **`sl-`** (Spec Ledger — short, easy to find).

Start with [sl-plan](sl-plan/SKILL.md), [sl-work](sl-work/SKILL.md), and
[sl-check](sl-check/SKILL.md). These entry points reuse the focused procedures
below; approval follows the user's revision or delegation choice. A [selected engineering method](../docs/architecture/workflows.md) can replace the procedures and skills for individual steps while the shared tools retain permission and evidence gates.

These skills stay **in this repo** for now (ledger pipeline). Do **not** move
them into [`nessalabs/skills`](https://github.com/nessalabs/skills) yet —
consolidation later if other Nessa products adopt the ledger.

## Companion engineering skills (optional install)

Install separately when available (plugin / `npx skills add nessalabs/skills`):

| Skill | Use with |
| --- | --- |
| `system-architect` | Shape, spec-break, build — boundaries, core vs product, failure-first |
| `coding` | `sl-dev-build` — how to make a change |
| `method` | `sl-dev-break` / debugging |
| `pull-requests` | Commit/PR shape (with our `SL-Turn:` trailers) |

**Always** apply the inline subset:
[`references/cheap-to-change.md`](./references/cheap-to-change.md) — even if the
companion pack is not installed.

When writing any review JSON, also apply
[`references/review-copy.md`](./references/review-copy.md)
(`plainSummary` / `plainImpact`; schema `schemas/review.json`).

Turn / workstream list titles:
[`references/plain-titles.md`](./references/plain-titles.md)
(`restatedGoal`, workstream `title` + `objective`).

## Lanes

| Lane | Meaning |
| --- | --- |
| `sl-plan-*` | Before code: vision, shape, seal-side adversary |
| `sl-dev-*` | Implementation: build, code adversary, verify/close |
| `sl-learn` | Capture high-signal corrections → learnings/tenets |
| `sl-security-review` | Security discovery and focused boundary review within existing lanes |

| Skill | Job |
| --- | --- |
| [`sl-plan-vision`](./sl-plan-vision/SKILL.md) | Vision + tenets + **quality bar** |
| [`sl-plan-shape`](./sl-plan-shape/SKILL.md) | Grill → workstream |
| [`sl-plan-decompose`](./sl-plan-decompose/SKILL.md) | Carve bet → e2e verticals |
| [`sl-plan-break-spec`](./sl-plan-break-spec/SKILL.md) | Spec adversary → seal |
| [`sl-dev-build`](./sl-dev-build/SKILL.md) | Build sealed verticals |
| [`sl-dev-align`](./sl-dev-align/SKILL.md) | Path coverage align check + approve (cheap model) |
| [`sl-dev-break`](./sl-dev-break/SKILL.md) | Code adversary |
| [`sl-dev-verify`](./sl-dev-verify/SKILL.md) | Turn close + digests |
| [`sl-learn`](./sl-learn/SKILL.md) | Learnings / tenet promote |
| [`sl-security-review`](./sl-security-review/SKILL.md) | Security model → abuse-case acceptance → verified boundary findings |

Pipeline: `sl-plan-vision` → `sl-plan-shape` (verticals via `sl-plan-decompose`)
→ `sl-plan-break-spec` → seal →
`sl-dev-build` (`context` → open → code → **`sl-dev-break`** → close) →
(`sl-learn`) → `sl-dev-verify`

Trust / quality bar set at vision+shape turns the **same** gates harder or
softer (hobby vs prod) — no parallel skill trees.
