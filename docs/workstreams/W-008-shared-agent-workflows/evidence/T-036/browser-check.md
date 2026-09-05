# Execution activity browser verification

Manual browser observation on 2026-09-05 UTC, isolated fixture on port 3840. This report records observations; it is not an automated passing check.

The fixture was created with the real MCP lifecycle helper in `packages/mcp/src/execution.lifecycle.test.ts`: permission, plan review, open turn, executable greeting check, and execution registration. A real MCP activity write reported a tool start.

Observed `/workstreams/W-001` in browser tab 13:

- Acceptance progress showed Verified 1/1 (100%) and Implemented 0/1. The page still listed missing current code review, implementation report, and open-turn closure. Passing tests did not imply completion.
- Agent execution showed the registered task/session, one reported in-flight tool, one accepted event, no duplicates, continuation off, zero dispatch attempts, and all host controls unavailable.
- Remaining-work guidance identified the specific acceptance criterion and evidence status. The continuation prompt was explicitly labeled not sent.
- A real CLI `record_activity` waiting-user event changed the same page on its normal polling cycle, without navigation: Waiting for user, reason, two retained events, and the still-unresolved tool invocation. Evidence stayed 1/1 passing.
- After stopping only the owned fixture server, the same page showed Live updates disconnected / showing the last observation and retained its waiting state and evidence.

The fixture server was stopped after verification. The user's port 3737 server was left running. UI production build also passed with an isolated `.next-build` output directory.
