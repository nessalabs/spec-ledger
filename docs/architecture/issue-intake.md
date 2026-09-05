# Bugs discovered during work

A user can report an issue in the active conversation. Link the source to the affected workstream and capture a decision describing the observation, discovery method, cause when known, and regression check. Create a separate workstream only when the work is independent or would materially interrupt the current scope.

Classify the finding before changing the spec:

- `code-defect`: implementation violates existing intent; fix code and test it.
- `spec-gap`: a required behavior was omitted; amend the spec with the new acceptance.
- `spec-conflict`: intended behaviors contradict; resolve and record the choice.
- `verification-gap`: existing checks missed the relevant failure; improve evidence.
- `workflow-gap`: the process failed to retrieve, review, or enforce a commitment.

The existing decision record owns optional `discovery` data: `kind`, `reportedVia`, `observation`, `cause`, `specRef`, and `regression`. Source and evidence files remain separately linked. A spec amendment references that decision, so there is one authoritative explanation. Do not change acceptance to make incorrect code look compliant.

Repeated classifications are evidence for a learning candidate. Review the actual causes before changing a skill or promoting a standing rule. An isolated layout bug does not justify a new universal process. Preserve original observations and supersede guidance explicitly so subsequent agents can distinguish active rules from history.
