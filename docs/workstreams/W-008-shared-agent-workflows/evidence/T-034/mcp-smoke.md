# Local MCP transport observation

During T-034 an official MCP v2 Client launched `packages/mcp/dist/main.js --root ../..` with the MCP package as its working directory.

- Tool discovery returned 13 named operations, including passive session reads and explicit permission, progress, review, check and completion writes.
- `get_session` returned W-008, open turn T-034 and zero passing requirements, matching the current website state.
- `record_decision` persisted T-034/D-02 through the shared operation path.
- Repeating exactly the same request ID and input returned an identical result instead of creating another decision.

This checks the real executable and a retry on this checkout. It is not a substitute for the full disposable-fixture lifecycle, negative-path tests, packed executable test or independent review.

After restarting the development server with the corrected installed-package resolver, the browser home view rendered T-034/D-02 under “Meaningful changes”. It continued to show zero passing requirements and a required current code review. Thus the MCP-written record appeared in the UI without being presented as passing evidence.
