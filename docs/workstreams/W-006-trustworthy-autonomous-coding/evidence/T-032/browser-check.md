# Local approval browser observations

Manual agent observations on 2026-09-04, using the in-app browser and an isolated fixture at port 3838. No real workstream permission was changed by the browser test.

- The unapproved fixture displayed Approve this revision and Deny.
- First approval attempt returned unavailable: Next normalized the request URL hostname differently from the browser Host. Fixed the adapter to validate both loopback hosts and matching ports, with origin bound to the browser Host. The independent regression now covers this case.
- Retrying through the UI displayed Approval saved and Approved to proceed, removed the approval buttons, and retained failing/missing evidence and the due tenant-isolation obligation.
- A direct read of the fixture authority confirmed a persisted revision grant. Reloading the page still displayed Approved to proceed without approval buttons.
- The session selector opened a Nessa UI menu with the current workstream selected.
- The home page contains the live session; the duplicate Specs and history overview is absent.

This is manual observation, not a browser automation regression test. Endpoint and authority failures, stale revisions, retries, and route aliases are covered by the automated suites. Previous rail and graph observations remain in T-031/browser-check.md.
