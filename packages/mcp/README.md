# @nessalabs/spec-ledger-mcp

Local stdio MCP adapter for Spec Ledger. Install it beside the ledger CLI:

```bash
npm install --save-dev @nessalabs/spec-ledger @nessalabs/spec-ledger-mcp
```

Configure an MCP host to launch one server for one checkout. Use an absolute
checkout path so the server always binds to the intended repository:

```json
{
  "mcpServers": {
    "spec-ledger": {
      "command": "npx",
      "args": [
        "--no-install",
        "spec-ledger-mcp",
        "--root",
        "/absolute/path/to/checkout"
      ]
    }
  }
}
```

The checkout is fixed when the process starts; tool inputs cannot select another
repository. `plan_work`, `get_context`, and `get_session` are passive reads and
do not create operation receipts. `run_checks` explicitly runs configured check
commands. The other tools record permission, work, progress, decisions,
evidence, reviews, alignment, turn completion, or workstream completion.

Every tool is also available through the JSON CLI operation surface. This is
useful for debugging exactly what an MCP host would invoke:

```bash
spec-ledger operation get_session \
  --file ./get-session.json \
  --root /absolute/path/to/checkout

spec-ledger operation record_progress \
  --file ./record-progress.json \
  --root /absolute/path/to/checkout
```

Mutation inputs require a `requestId`. Retry an interrupted call with the exact
same request ID and input. Reusing the ID with different input returns
`idempotency_conflict`. A started call without a durable completion receipt
returns `execution_unknown`; choose a new request only after reconciling the
ledger state, because the original effect may have completed.

`record_permission` stores portable `agent-reported` provenance. It records the
authorization reference supplied by the caller; it does not authenticate that
reference. Portable `record_review` calls cannot claim `human` provenance.

## Chosen engineering methods

`preview_workflow` resolves a proposed local profile without writing it. `set_workflow` preserves the chosen method under the workstream's existing permission. `get_workflow` returns the same effective stages, skill content, output references and blockers shown in the session UI. `begin_workflow_step`, `report_workflow_attempt` and `record_workflow_output` record attempts without inventing passing evidence.

These names also work with `spec-ledger operation <name> --file input.json`. See the repository's [engineering method contract](../../docs/architecture/workflows.md) for a skill-substitution example, snapshot amendments and the finite output types. Local skill access never installs or executes the skill. A custom method cannot waive permission, stale evidence or required reviews.
