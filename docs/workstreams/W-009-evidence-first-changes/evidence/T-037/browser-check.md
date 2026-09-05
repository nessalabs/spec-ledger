# Browser verification of change evidence and historical completion

Manual observation, 2026-09-05 UTC. This is a recorded walkthrough, not an automated test result.

T-036 on the real port 3737 website now leads with its single activity acceptance criterion, SL-025 definition, current/stale status, saved historical run ID/time/source and output, then its three integrity-checked artifacts. Technical commits/docs/decisions/files are in a collapsed section after evidence. No other W-008 slice is presented as T-036 proof. Source edits during this repair correctly made earlier results stale.

W-005 now says Completed earlier / verification needs attention. The progress section explains that current coverage does not mean the work was never built, and identifies the one unmapped optional-release criterion. Its seven supported criteria show named behavioral command definitions; no path-existence pass is substituted. The original method is collapsed and labeled current requirements, not original execution history.

The actual Git regression creates temporary histories and verifies that exact SL-Turn trailers select the right commit while adjacent turn IDs and prose mentions do not. T-036 resolves to its own 6d71f81 commit rather than the previous 0717abb snapshot. No historical facts were rewritten.
