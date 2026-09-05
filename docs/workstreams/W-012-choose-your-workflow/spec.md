# Choose how your agent works

## Outcome
From a dedicated Workflows page, choose the default workflow or customize the steps and skills the agent should follow. Preview the exact guidance and requirements before applying it. The agent uses the same selected workflow through CLI or MCP; saving a workflow does not launch an agent.

## This change
- Add a workflow editor on the Workflows page with a name, ordered stages and steps, local skill selection, required output choices, and accessible move/add/remove controls. Start from the default or the current selection. Support exporting and importing a profile for reuse; no separate marketplace or scheduler.
- Offer bundled guidance and a bounded inventory of local SKILL.md files under skills, .agents/skills and .claude/skills. A relative path allows other files inside this checkout. Never install, execute or scan outside the checkout. Skills with uncertain capabilities need explicit acknowledgement.
- Preview through the existing resolver. Show the resolved steps, guidance and output requirements. Apply only the reviewed profile and skill content; reject source, revision or selected-workflow changes since preview. Preserve old selections and require an amendment reason. An uncertain save retries the same request identity, never silently creates another selection.
- Use the shared set_workflow/preview_workflow operations for browser, CLI and MCP. Add a narrowly scoped loopback-only browser bridge using the existing explicit-action security pattern; the generic server remains read-only. Reads never apply workflows or start steps.
- Keep permission, spec review, implementation, evidence and code review gates outside editable skill prose. Required review output contracts cannot be replaced by an attestation or a renamed role. Invalid stage order and missing mandatory output kinds are rejected.
- Keep the section bar and content start stable when switching between longer Evidence and shorter Changes panels; preserve deep links and browser history.
- Fix the reported React key warning when the server-rendered change history is composed with live updates.

## Acceptance
1. A user can open the Workflows page, create a named workflow with multiple steps and chosen bundled/local skills, preview it, apply it, reload and inspect the preserved selection. Export/import allows reuse. The CLI and MCP observe the same selection and can begin the eligible step using the existing protocol.
2. Missing/escaping skills, invalid profiles, omitted required checks/reviews, stale previews and unauthorized browser requests fail without changing the selection. Amendments preserve prior snapshots. Repeated saves with the same identity have one effect; opening the editor performs no writes or execution.
3. Step controls work with a keyboard and at narrow width; technical configuration stays on the Workflows page. The change history renders without React key warnings and switching sections does not displace the pinned navigation.

## Boundaries and proof
The workflow domain owns resolution and gates; application operations own mutations and freshness. The local bridge only dispatches a fixed set of workflow operations; UI imports the client gateway. No host runner, global skill installation, remote skills, arbitrary shell execution, or claim that reading a skill proves compliance. This is local and library-consumer functionality with a browser write boundary: prove same-origin/token checks, bounded requests, path confinement, conflict and retry behavior, and actual UI-to-shared-operation selection. Independent spec and code review are required.

## Security model
The local operator may configure workflows within existing task permission. An unrelated website must not read local skill guidance or change selections. Skill files and imported profiles are untrusted data, never instructions to the server. The local bridge enforces loopback, same-origin/token and bounded request checks; the resolver confines physical skill paths (including symlinks) and bounds file content; the mutation validates preview configuration, revision, source and selection freshness. Negative tests compare persisted selections before and after rejected requests, alongside an authorized save. Unrestricted local filesystem writers remain outside this cooperative protocol’s enforcement boundary.

## Placement correction
The workflow editor, selected steps, process requirements and agent activity live together on their own Workflows page. Spec pages link there; they do not embed the configuration or process stack. Workflows is reachable from navigation and links back to the associated spec.
