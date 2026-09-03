# Cheap to change — gems for Spec Ledger agents

Keep Spec Ledger `sl-*` skills **separate** from
[`nessalabs/skills`](https://github.com/nessalabs/skills). When that repo is
installed for the agent, also load **`system-architect`** and **`coding`** for
depth. This file is the **inline subset** every `sl-plan-*` / `sl-dev-*` agent
must honor even without that install.

Prime directive: **optimize for the cost of the next correct change**, not the
elegance of this one. Structure is a product decision.

## Pillars (use as a checklist)

1. **Information ownership** — put the decision where the knowledge lives; don’t
   make callers pass three facts so a callee can branch.
2. **Stable boundaries** — minimal contracts; modules know as little as possible
   about each other. Dependencies point one way (adapters → application → domain).
3. **Mechanism ≠ policy** — reusable machinery must not embed product rules.
4. **Small core** — product capability composes **on top of** core; core never
   learns feature names / `if (productX)`.
5. **Vertical isolation** — one e2e-checkable slice beats a horizontal layer chore.
6. **Failure & invariants first** — crash mid-way, run twice, race, bound every
   queue/retry — before the happy path.
7. **No speculative abstraction** — extract on the second real use; no flags
   nobody asked for.
8. **Local reasoning** — a reader understands one module without the whole system.

## Quality bar (set in vision / trust — same skills, different dials)

| Bar | What changes |
| --- | --- |
| Hobby / spike | Lighter evidence; still name invariants; still no silent false `pass` |
| Library / staging | Trust flags honest; unit+integration; code-break with run evidence |
| Prod / money / auth | Correctness/security critical; fuller attack menu; stricter seal deviation |

Do **not** invent parallel `sl-hobby-*` skill trees. Turn the dials in
`vision` + workstream `trust` / `policy`.

## Before you shape or seal

- Name concepts in **product words** (turn, claim, seal — not invented jargon).
- Say which **feature / package boundary** owns the change.
- Acceptance must be **testable**; out-of-scope kills speculative platforms.
- Verticals = independently fail-able **moments**, not “all schemas then UI”.
- Ask: *how does this get deleted?* If the answer spans half the monorepo, recut.

## Before you write code

Answer in the turn (decision or short note) if non-obvious:

1. Who has the information for this decision?
2. What is the invariant and who enforces it?
3. Crash halfway / run twice / race?
4. How does this get deleted?
5. Does this widen the **core**, or compose on top?

Write the **smallest** thing that makes the sealed acceptance true. Match
neighboring code’s style. One reason per commit; `SL-Turn:` trailer when open.

## Before you break / review

- Hunt failure modes (wrong principal, cancel/drop, partial failure, clock,
  poison input, mock-never-hits-prod) — see `sl-dev-break`.
- Smells that mean recut: feature always touches 3+ modules; dependency cycle;
  shared type growing optional fields; “just add a flag”; core branched on a
  product feature; machinery changes every time a rule changes.

## Absences we keep (Spec Ledger)

- Verify never invents `pass` from episodes/compass.
- UI → client only; server GET-only; git write path.
- Breaker owns killer tests; builder owns prod — no oracle negotiation.
