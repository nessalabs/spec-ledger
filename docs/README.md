# Spec Ledger docs

| Folder | What belongs here |
| --- | --- |
| [`architecture/`](./architecture/) | **Contracts** — implement against these |
| [`workstreams/`](./workstreams/) | **Specs and supporting notes** — one folder per new workstream; [index](./workstreams/README.md), metadata in `.spec-ledger/workstreams/` |
| [`compass/`](./compass/) | **Vision / standing prose** — linked from `.spec-ledger/vision.json` |
| [`research/`](./research/) | Frozen inputs that informed the contracts |

Do **not** check in subagent / model review transcripts. Keep **decisions and why**
in [`../DESIGN.md`](../DESIGN.md) and the architecture docs.

Root [`DESIGN.md`](../DESIGN.md) = verify invariant, packages, truth ownership,
settled decisions. Work-model / episodes = how work and turns work.

## Start here

1. **[architecture/work-model.md](./architecture/work-model.md)** — compass, hierarchy,
   seal, trust, alert defaults
2. **[architecture/episodes.md](./architecture/episodes.md)** — turn spine +
   decisions / sources / reviews / flows / audit + **doc↔turn↔commit** +
   **finding→decision** trails + query layout
3. **[DESIGN.md](../DESIGN.md)** — claims, bindings, verify, package cut, settled decisions
4. **Skills** under [`skills/`](../skills/) — see [`skills/README.md`](../skills/README.md) (`sl-plan-*`, `sl-dev-*`, `sl-learn`)
5. **Git hooks** — [`scripts/git-hooks/`](../scripts/git-hooks/) (`pnpm hooks:install`)
6. **[Shared agent tools](./architecture/agent-tools.md)** — CLI/MCP ownership, execution and retry contracts
## Research (consumed)

- [research/project-anatomy.md](./research/project-anatomy.md)
- [research/high-velocity-decisions.md](./research/high-velocity-decisions.md)

On conflict, **architecture + DESIGN** win.

- [Engineering methods](architecture/workflows.md): chosen skills, preserved snapshots, stage attempts and typed output gates.
- [Execution activity](architecture/execution-activity.md): bounded hook signals, task association and honest continuation readiness.
