---
name: sl-dev-experiment
description: >-
  Attach optional iterative goals and experiment history to existing authorized work.
  Use when the user requests optimization or recursive improvement, or an agent
  identifies work whose outcome is best pursued through bounded experiments.
---

# sl-dev-experiment

This is **additional** to the existing work model. Ordinary tasks keep their current process. The user can name iterative work, or the agent can choose it when repeated hypotheses and measured/qualitative findings make the work clearer. Do not force every task into an experiment or replace plans, turns, reviews, checks or completion gates.

1. Follow `sl-dev-build`: preserved plan, applicable permission and an open workstream turn first.
2. Attach a goal with `spec-ledger goal create --file`. Name objective, stopping rule, optional maximum attempts, and optionally a fixed metric/protocol/baseline/target. This record marks the task as iterative. Omit a numeric metric for qualitative improvement.
3. Record an attempt before running it: `experiment start --file` with hypothesis/change, current turn and optional already-finished parent in the same goal.
4. Perform only already-authorized work. Use the fixed evaluation protocol, inspect correctness separately, and record one immutable result with `experiment result --file`. Include findings and reported retention (`kept`, `discarded`, `inconclusive`). A failed attempt is inconclusive and has no measurement. Do not report fabricated scores or verification pass.
5. Inspect `goal show --id` and the existing UI's `/experiments/<goal-id>` page. Decide the next attempt using findings, confirmed tenets, the stopping rule and the user's scope. Budget exhaustion blocks new attempts; silence never expands permission.
6. After all pending attempts have results, `goal conclude --file` records the stopping reason and summary. Then continue normal code-break, evidence, turn close and workstream completion. Goal conclusion does none of those automatically.

A later authorized turn in the same workstream can continue the same goal. Every write names that current open turn. Changing the metric or evaluation protocol requires a new goal. Duplicate record IDs are safe only for identical content; use shared operation request IDs for exact retries. A headless agent can capture the inspect view as a screenshot; sharing still follows the user's communication authorization.

CLI/MCP examples, result semantics, storage and limitations: [experiments.md](../../docs/architecture/experiments.md).
