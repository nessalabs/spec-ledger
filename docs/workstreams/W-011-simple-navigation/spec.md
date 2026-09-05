# Find the spec, progress and proof easily

## Problem
The website exposes its storage concepts as navigation and stacks progress, engineering steps, agent activity, requirements and history into a long page. Users cannot easily decide where to go to read the spec or inspect proof.

## Outcome
Keep the existing Nessa UI styling and real data. Organize the website around following work, reading specs and examining evidence. Technical exploration remains available as a secondary destination.

## This change
- Three primary destinations: Follow work, Specs, Evidence. Put Changes, project guidance, features, graph and contracts in a clearly named secondary navigation group. Existing URLs remain valid and show their location; the menu remains usable on narrow screens.
- Home keeps the selected spec, permission controls, current acceptance progress and actionable attention visible. Provide obvious Read spec and View evidence links. Group requirements, activity and engineering details into clearly labeled sections instead of showing everything at once; omit empty optional cards from the overview.
- Spec detail groups evidence, work history and process details so readers can switch between them without losing the spec. Evidence must remain one obvious action away, including test source, real output and explicit rerun. Preserve section deep links and browser back/forward.
- Explain whether workflow status is inferred from existing records or comes from an explicitly selected method with attempts. Do not imply an agent runner is active when no execution is registered.

## Acceptance
1. From the home page a reader can open the selected spec and its evidence; primary navigation has three clear destinations, technical pages remain reachable, and navigation works with a keyboard and at narrow width.
2. Spec detail separates evidence, history and process into navigable sections; old evidence/method/activity anchor links still reveal the right section and browser history restores selection. Approval, verification freshness, gaps and actual test execution behavior are unchanged.

## Boundaries and verification
UI-only composition through the existing client. No new workflow engine, host runner, or data migration. No weakened permission or verification gates. Use behavioral navigation tests, an independent breaker and a live browser walkthrough; verify existing evidence regressions and build the UI.

## Workflow use today
The repository currently uses the default workflow projection inferred from plan/review/progress/check records. There are no explicitly selected workflow snapshots or step attempts in this checkout, nor registered agent executions. The shared workflow operations exist and are tested, but that does not mean this session was run by them.
