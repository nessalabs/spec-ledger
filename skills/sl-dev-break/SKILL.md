---
name: sl-dev-break
description: >-
  Spec Ledger (sl-dev): adversarially falsify a vertical while the turn is open.
  Owns failing killer tests + run evidence; must not be the same write-set as
  the builder. Use after sl-dev-build implements a slice. Triggers: break it,
  stress test, sl-dev-break, code adversarial.
---

# sl-dev-break

Falsify the **implementation** on an **open** turn. Prefer this over vibe
review. Spec gaps → [`sl-plan-break-spec`](../sl-plan-break-spec/SKILL.md)
before seal.

Contract: [`docs/architecture/work-model.md`](../../docs/architecture/work-model.md) §3.4;
review shape: [`episodes.md`](../../docs/architecture/episodes.md) §6.6;
Spec Ledger UI copy: [`../references/review-copy.md`](../references/review-copy.md).
Structure / failure-first:
[`../references/cheap-to-change.md`](../references/cheap-to-change.md)
(+ `method` from nessalabs/skills when installed).

## When to run

| Situation | Action |
| --- | --- |
| Implementation done; turn still `open` | Run if `policy.requireCodeBreak` |
| Turn already `closed` | Do **not** add reviews — open a **new** turn |
| Spec not sealed and no bypass | Run sl-plan-break-spec first |
| `trust.performanceCritical` false | Do **not** invent load tests |

## Hard rules

### Breaker ≠ builder (write split)

| Role | Owns | Must not |
| --- | --- | --- |
| **Breaker** (`sl-dev-break`) | Killer **failing** tests; adversarial `reviews/` with **run evidence**; optional property/fuzz harness under test paths | Edit production code to go green; weaken/delete/rewrite the killer so it passes for the wrong reason; hand-edit digests/facts |
| **Builder** (`sl-dev-build`) | Production code (and non-adversarial tests they already owned) until the killer fails for the **intended** reason, then passes | Edit the breaker’s killer test to negotiate the oracle; remove assertions; change the scenario so the bug is untested |

If the same human/agent session must wear both hats: still **split the writes**
in time (breaker commit/review first → builder only touches prod). Same turn
grading its own slice without that split **contaminates the hunt** — forbidden.

**Same-agent extra rule:** the mandatory out-of-intent killer (below) must attack
a path/scenario the builder did **not** name in `intent` (acceptance,
outOfScope, restatedGoal, keywords, summaryForSearch). Prefer a separate
breaker agent when policy/runtime can split.

### Host: launch breaker as a subagent

In Cursor, the **builder must not** author the adversarial review JSON itself.
Launch a Task subagent for `sl-dev-break` (and similarly for
`sl-plan-break-spec`):

| Preference | Task `model` |
| --- | --- |
| Same class as builder (default here) | `inherit` |
| User named a model (e.g. Fable) | that slug only |

Ask once per session/setup if unset. Standing rule:
[`.cursor/rules/review-subagent-models.mdc`](../../.cursor/rules/review-subagent-models.mdc).

### Evidence is structural — no run, no review

A code-adversarial finding is invalid without proof of a run. Schema rejects
bare `evidencePath` strings. Each finding needs **one** of:

```ts
evidence:
  | {
      kind: "command"
      command: string           // exact command run
      observedOutput: string    // hygiened excerpt — fail lines / assert message
      exitCode?: number
    }
  | {
      kind: "test"
      citedTest: string         // file::name or stable test id
      ran: true                 // const true — unrepresentable otherwise
      command?: string
      observedOutput?: string
    }
```

“Must be a test” lives in the schema, not only in this skill.

### Pass has a shape and a stop

| Verdict | Required |
| --- | --- |
| `request-changes` | ≥1 finding, each with `evidence` as above |
| `approve` (pass) | `killersCited: string[]` **non-empty** — ids of killers you ran (citedTest or command labels). Empty killers = invalid pass. |
| `comment` | Non-blocking notes only; does **not** satisfy `requireCodeBreak` |

**Hunt budget:** after covering acceptance + the attack menu against the slice,
add **at most one** extra “0.1%” killer the builder did not mention in intent —
unless `trust.correctnessCritical` or `trust.securitySensitive` (then one extra
per flag, still capped). Do not burn the turn on an unbounded hunt.

## Attack menu (domain-agnostic)

When `trust.securitySensitive` or the slice's trust boundary warrants it, use
[`sl-security-review`](../sl-security-review/SKILL.md) for focused security
investigation. Keep this skill's hunt budget, separate breaker ownership, and
run-evidence requirements; unverified hypotheses do not become confirmed findings.

Pick what fits the slice; do not import another repo’s event vocabulary.

1. **Wrong principal** — authz / tenancy / “acting as” mismatch  
2. **Cancel / drop** — caller aborts mid-flight; message/job dropped  
3. **Partial failure** — one dependency fails; half-committed state  
4. **Clock** — skew, rewind, expiry, “eventually” races  
5. **Poison input** — unexpected null, huge, wrong type, hostile string  
6. **Mock never hits prod** — green only because the real boundary was stubbed  

Four-line hunt:

```
1. Name the invariant (claim / acceptance line).
2. Pick a menu row (or intent path) that could falsify it.
3. Write a killer that fails for that reason — run it — record evidence.
4. Stop when budget met; approve only with killersCited, else request-changes.
```

Also watch structural smells: mock-only green paths, core branched on a product
feature, machinery that must change when a rule changes, unbounded retry/queue.

(Example-only: other products’ keels / EventLog lists are **not** dependencies of
this skill — do not @-pull them into a Spec Ledger tree.)

## Sealed-spec deviation

If the killer proves behavior the sealed workstream did not allow:

1. Ensure a turn `decision` (`deviate`|`clarify`|`add`) + `postSealAmends[]`.
2. Surface to the human.
3. Apply `policy.onSealedSpecDeviation` (`move`|`block`|`wait` + timeout).
4. Never quiet-reseal.

## Method

1. Read sealed workstream, slice acceptance, claims/bindings, **turn intent**,
   builder tests (do not treat them as the hunt).
2. Map invariants → attack-menu rows + intent paths.
3. Add killer tests under breaker ownership; **run** them; capture evidence.
4. Enforce hunt budget (one out-of-intent killer unless trust expands).
5. Write review (`request-changes` or `approve` with `killersCited`).
   Spec Ledger UI-facing copy is required — follow
   [`../references/review-copy.md`](../references/review-copy.md):
   - review `plainSummary`: **one sentence** of what a human should take away
     (end behavior, not internals).
   - each finding `plainImpact`: **one sentence** of what would happen if this
     shipped (who/what would go green wrongly, what a user could sneak through).
   Keep `summary` / `gap` / `fixProposal` for the technical trail. Do not dump
   function names into `plainImpact`.
   If using CLI: always pass `--plain-summary` (required).
6. Findings ≥ `alertOnSeverity` → `policy.onAlert`; `blocking` per block/wait.
7. Hand back: builder may change **prod only** until killers fail-then-pass for
   the intended reason. Breaker re-runs killers; does not edit them soft.
8. Set `suggestedSlices[].codeBreakReviewId`.

### `request-changes` example

```json
{
  "schemaVersion": 1,
  "id": "T-00N/R-01",
  "turnId": "T-00N",
  "kind": "adversarial",
  "target": "code",
  "reviewer": "agent:sl-dev-break",
  "verdict": "request-changes",
  "blocking": true,
  "summary": "Partial failure leaves digest stamped without rows",
  "plainSummary": "A failed ingest could still look like a passing verify.",
  "findings": [
    {
      "id": "F-01",
      "severity": "high",
      "claimId": "SL-00N",
      "gap": "When bindings ingest throws mid-batch, report still ok:true",
      "plainImpact": "Verify would say pass even though some required evidence never landed.",
      "fixProposal": "Fail closed; do not write ok:true on partial ingest",
      "evidence": {
        "kind": "test",
        "citedTest": "packages/ledger/src/verify/verify.test.ts::partial ingest",
        "ran": true,
        "command": "pnpm --filter @nessalabs/spec-ledger test",
        "observedOutput": "AssertionError: expected ok === false"
      }
    }
  ],
  "alertOnSeverity": "high",
  "residualRisks": []
}
```

### `approve` example (pass — killers required)

```json
{
  "schemaVersion": 1,
  "id": "T-00N/R-02",
  "turnId": "T-00N",
  "kind": "adversarial",
  "target": "code",
  "reviewer": "agent:sl-dev-break",
  "verdict": "approve",
  "blocking": false,
  "summary": "Killers red then green for intended reasons",
  "plainSummary": "The attack tests failed for the right bugs, then passed after the fix.",
  "killersCited": [
    "packages/…/foo.test.ts::wrong principal denied",
    "packages/…/foo.test.ts::poison input rejected"
  ],
  "findings": [],
  "alertOnSeverity": "high",
  "residualRisks": ["Hunt budget: one out-of-intent killer used (clock skew)"]
}
```

## Exit summary

```
code-break: T-00N / SLC-01
verdict: request-changes|approve
killersCited: …
evidence_runs: N
out_of_intent_killers: 0|1
write_split: breaker-tests|builder-prod
alertOnSeverity: high
onAlert: move|block|wait
blocking: yes|no
sealed_deviation: none|move|block|wait|timed-out-move|timed-out-block
next: builder prod-fix | breaker re-run | human | wait-timeout | close
```

## Absences

- Not a substitute for verify — improves evidence into verify
- Not a spec review — too late without documented amend
- Attestation alone never clears a correctness-critical claim
- No approve without `killersCited`
- No finding without `evidence` run proof
- No builder edits to breaker killers; no breaker edits to prod to “help”
