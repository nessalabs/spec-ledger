# Browser simplicity check

Checked the live W-012, W-010, and W-012 workflow routes at `http://127.0.0.1:3737` as a nontechnical reader after the simplification pass.

## Result

The main feature view is substantially easier to understand. The title is immediately followed by a plain objective, Workflows is now primary navigation, the evidence section is named **What proves it**, and the longer progress explanation, version metadata, supporting files, and technical evidence are presented as secondary details. A reader can now answer what W-012 does, where to configure it, and why it needs attention without first decoding the ledger model.

W-010 also improves: its objective plainly says that the feature inspects and reruns a saved check, while the top status says **Completed earlier · needs attention** and identifies the missing current evidence. This is much more honest than presenting 100% or Passing as the dominant state.

The workflow view is also clearer. **Standard workflow · progress inferred from records, not tracked agent activity** is a concise explanation of what the default means, and technical profile/digest/CLI details are subordinate. Making Workflows a primary navigation item fixes the earlier discoverability problem.

## Remaining serious confusion

1. **“Completed earlier” still competes with “needs attention.”** This is accurate, but a new reader may still interpret “completed” as “done now.” Prefer **Needs rechecking** as the single prominent state, with “Originally completed in revision 3” in version/history details.

2. **The W-012 objective says “inspect their progress and evidence,” but no agent session exists and workflow progress is inferred.** The promise sounds live while the workflow page says it is not tracked agent activity. Prefer “choose the steps and skills your agent should follow, then inspect the recorded workflow and evidence.”

3. **The requirement text under What proves it remains technical.** W-010 starts with “CLI, MCP and local UI run the same saved check with bounded inspectable output, current source/check provenance, honest metadata, retry safety and passive read surfaces.” That is contract language, not user proof. Lead with the linked plain requirement: “You can inspect and rerun the same saved check from the website or agent tools.” Put the exact acceptance criterion in technical details.

4. **“Current checks verified” is too positive beside “Current passing evidence is not available.”** “Verified” appears to describe the evidence connection or refresh, but reads as a successful test result. Rename it **Evidence checked just now** or simply show the observation time.

5. **View proof still needs an explicit plain result.** The control is well placed, but the proof view should begin with three lines: what ran, whether it passed for the current version, and when it ran. Commands, run IDs, hashes, artifact paths, producer names, and “historical observation” belong under technical details.

6. **Workflow stages still expose internal vocabulary once expanded.** Labels such as contract, inferred output, method digest, capability declared, and typed output should remain collapsed for ordinary readers. The default stage summary should be the step name, its state, and the missing action.

## Interaction limitation

The isolated browser session became unavailable during this recheck, so the refreshed routes were verified from their live server-rendered UI output. The direct **View proof** control and its surrounding content were inspected, but its client-side click transition could not be exercised in this pass. This note therefore does not claim interactive proof-drawer verification.

## Builder interactive follow-up
The independent agent reported a browser bridge limitation. The builder separately opened the production W-012 page in agent-browser, clicked the first View proof disclosure and observed What this checks, input/setup, expected behavior, highlighted Test source, Saved command, Run again, Refresh evidence and Actual test output with a finished result. No Run again click was performed. Browser errors were empty. This confirms the client-side disclosure separately from Sol's read-only route recheck.
