# Research — High-velocity work patterns → Spec Ledger turns

> **Status:** research input (frozen). Decisions/sources design landed in
> [`../architecture/episodes.md`](../architecture/episodes.md); work hierarchy in
> [`../architecture/work-model.md`](../architecture/work-model.md).

Date: 2026-09-02  
Question: How do humans decide under high velocity, and what should Spec Ledger encode (especially decision + information sources)?

## Sources (primary / near-primary)

| Source | What it owns |
| --- | --- |
| Eisenhardt, K. M. (1989). *Making fast strategic decisions in high-velocity environments.* Academy of Management Journal, 32(3), 543–576. [doi:10.2307/256434](https://doi.org/10.2307/256434) | Empirics on *fast* teams in HV environments |
| Klein, G. — Recognition-Primed Decision (RPD) / Naturalistic Decision Making | How experts decide under time pressure |
| Drury, Zannier/Maurer, Power & Wirfs-Brock — NDM applied to agile / architecture | Software-specific NDM evidence |
| Nygard, M. (2011). [Documenting Architecture Decisions](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions) | ADR shape: context → decision → consequences |
| Snowden & Boone (2007). *A Leader’s Framework for Decision Making.* HBR. | Cynefin: clear / complicated / complex / chaotic |

## What high-velocity humans actually do

### 1. Speed ≠ less information (Eisenhardt 1989)

Counter-intuitive finding from microcomputer firms:

- Fast decision makers use **more** real-time information, not less.
- They develop **more** alternatives in parallel, not one “best” plan.
- They use a **two-tiered advice** process (counselor + broader input).
- They actively **resolve conflict** instead of waiting for consensus theater.
- They **integrate** strategic decisions with tactical plans (no orphan big bets).
- Faster decisions correlated with **better** performance in high-velocity settings.

**Encode:** a turn should allow multiple alternatives considered; decisions should cite **what new information** arrived; “we decided fast with no evidence” is an anti-pattern to surface, not celebrate.

### 2. Experts often don’t compare options exhaustively (RPD / NDM)

Under time pressure, experts usually:

1. Recognize cues (“this looks like X”),
2. Pick the first workable action,
3. Mentally simulate “will this fail?”,
4. Act — only invent creatively when the situation is unfamiliar.

Agile/architecture studies find NDM/RPD dominates day-to-day design; rational multi-option comparison is rarer and often reserved for novel problems.

**Encode:** don’t force every decision to list five alternatives. Support:

- `mode: recognition` — matched prior pattern / claim / prior turn
- `mode: compare` — Eisenhardt-style alternatives
- `mode: probe` — Cynefin complex: experiment, then sense

### 3. Context regime matters (Cynefin)

| Regime | Human pattern | Spec Ledger implication |
| --- | --- | --- |
| Clear | Sense → categorize → respond | `conform` to claim; little decision text |
| Complicated | Sense → analyze → respond | `clarify` / expert analysis; cite docs |
| Complex | Probe → sense → respond | `add` / `deviate` after a probe; capture what was learned |
| Chaotic | Act → sense → respond | Stabilize first; decision may lag the act — still record |

**Encode (optional field):** `situation: clear | complicated | complex | chaotic` — helps Spec Ledger UI explain *why* the decision looks thin or exploratory.

### 4. Motivation dies without bite-sized records (Nygard ADR)

Nygard’s problem statement matches agent/human handoff exactly: without rationale, successors blindly accept or blindly reverse.

ADR parts map cleanly:

| ADR | Turn decision |
| --- | --- |
| Context (forces) | `sources` + `specified` / claim refs |
| Decision | `kind` + `summary` + `actual` |
| Consequences | `consequences` + optional `followUpClaimId` |
| Supersede | later turn decision / claim supersession |

Standing ADRs remain claims (`kind: adr`). **Episode** judgments stay on the turn.

## Information sources (what led to the decision)

Humans don’t decide from “vibes” in good teams — they react to **new cues**. Capture the cue, not just the conclusion.

Suggested `sources[]` on each turn decision:

| `kind` | Example |
| --- | --- |
| `user` | Verbatim human instruction / correction mid-turn |
| `claim` | Re-read SL-003 / KER-001 |
| `doc` | DESIGN.md, ADR, protocol schema |
| `runtime` | Failing test, verify FAIL, profiler, log |
| `observation` | User repro, screenshot, prod metric |
| `prior-turn` | T-001 facts / prior decision |
| `external` | Vendor doc, RFC, paper, Slack from expert |
| `probe` | Result of a spike / A-B / canary |

Each source: `{ kind, ref?, quote?, learnedAt? }`.

This is Eisenhardt’s “more real-time information” made concrete, and RPD’s “cues” made reviewable.

## Recommended Spec Ledger shape

```
Turn
├── intent          # goal, acceptance, out of scope
├── decisions[]     # typed judgments THIS turn
│     kind: conform | clarify | deviate | add | defer | reject
│     mode?: recognition | compare | probe
│     situation?: clear | complicated | complex | chaotic
│     sources[]     # what NEW information triggered it
│     claimIds[] / docRefs[]
│     specified? / actual?
│     alternativesRejected[]?
│     consequences?
│     followUpClaimId?
└── facts           # turn close only — git, digests, blast radius
```

**Invariants (unchanged):**

- Decisions never mint `pass`.
- Facts never come from the agent.
- Deviate/add that should stick → claim update in same turn (or explicit `defer` + follow-up).

## What *not* to encode

- Full Cynefin workflow engine
- Mandatory five alternatives on every decision (fights RPD)
- Separate “decision ledger” outside turns (splits history)
- Treating chat transcripts as truth without a typed source row

## Practical human↔agent loop

1. Open turn with user intent (the first source).
2. As work proceeds, append decisions when cue arrives (`runtime` fail, `user` redirect, `doc` re-read).
3. Close turn → facts.
4. Spec Ledger UI: claim page shows decisions that cited it; turn page groups deviate/add first and shows source trail.

That is how high-velocity teams actually work: **short cycles, rich cues, recorded judgment, standing contracts**. Spec Ledger already has cycles (turns) and contracts (claims); decisions + sources close the judgment gap.
