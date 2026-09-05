# Understand a feature at a glance

## Outcome
A person can quickly tell what a feature does, whether it is complete, what needs attention, and where to inspect proof or configure the workflow.

## Scope
Simplify existing spec, progress, evidence and workflow presentation using existing Nessa components. Sol independently navigates the live site as a new user before changes. Use its observed confusion to remove repeated explanations, duplicate labels and internal identifiers from the default view. Keep outcome, current evidence counts and actionable failures visible. Put provenance, implementation reports, raw commands, historical records and explanatory notes behind clearly labeled disclosures. Keep proof directly expandable beside each requirement. Workflow remains on its own page with working navigation links. Add the feature objective near its title.

## Acceptance
1. A reader sees the feature outcome, current evidence progress and primary links without repeated summaries or technical bookkeeping; each requirement has a direct way to inspect checks, source and output.
2. Failed, missing or unlinked evidence, incomplete work, historical completion and disconnected observations remain honest and discoverable. Simplification must not invent completion or change execution, permission or evidence rules.

## Boundaries and checks
UI presentation only; no new runner, schema, verification behavior or approval flow. Reuse existing components. Use rendered regression tests for both passing and incomplete/historical cases, independent code review, production build and a browser walkthrough. User has explicitly authorized simplification; the initial Sol audit informs concrete copy choices. Existing local UI trust and evidence boundaries are unchanged.
