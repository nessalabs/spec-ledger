# First shared-tool slice browser checks

Observed the actual local development site through isolated in-app browser tabs during T-034.

- `/workstreams/W-008` rendered “Live evidence connected”, current requirement evidence and “Work history” with the open turn marked in progress.
- `/` rendered the real MCP-written T-034/D-02 decision and CLI-written T-034/D-04 decision under Meaningful changes.
- The page kept passing requirement counts separate from decision text, and showed unresolved blocking review findings until their resolution was recorded.
- The development server was restored after a Next config resolution failure; its restarted page rendered normally at the original port 3737.

These observations establish actual rendering and CLI/MCP-written data appearing in the UI. They do not claim custom workflow stages or recovery controls exist yet. This slice adds the shared live observer; later workflow verification must exercise transitions and disconnected retention with a controlled fixture.
