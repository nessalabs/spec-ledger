# Checks and observations

`spec-ledger check` explicitly executes command bindings and saves the resulting observations and report. The existing CLI `verify` command is a compatibility alias for this explicit operation. Commands have a two-minute timeout and a one-megabyte output limit; command output is not automatically copied into ledger summaries.

`verifyLedger`, client `verify`, snapshots, and HTTP GETs evaluate observations without executing commands or writing reports. An unobserved command binding is missing. Context reads show pending automation; opening a turn performs authorized resume transitions. Visiting a page cannot perform that transition.

A failed verification result is a successful HTTP read with `ok: false`. The transport uses HTTP 200 so clients can display the failures. Missing resources and invalid requests still use HTTP error statuses.

Every binding contributes to its claim verdict. Failure dominates missing evidence, which dominates attestation, which dominates pass. Duplicate results keys are rejected even if their values agree. Attestation never satisfies a required claim, and an empty ledger contains no verified requirements.

## Freshness and runner integration

`spec-ledger fingerprint` returns the current source-content fingerprint and one check fingerprint per binding. External runners capture these before execution, then emit rows with `sourceDigest`, `checkDigest`, and `runId`. Recheck the source after execution. Missing fingerprints are unknown evidence; a legacy passing result never silently becomes current. The built-in command runner captures and compares both source and check inputs itself.

Source fingerprints include tracked and untracked product contents and executable bits, not commit IDs. Ledger history and generated reports do not affect the source fingerprint. Check fingerprints include the claim and binding contents. Changing a check under the same ID invalidates its previous result. Source symlinks must resolve to observable files inside the checkout.

For external runners, `spec-ledger evidence record --file runner-evidence.json` accepts `bindingId`, `outcome`, the captured `sourceDigest` and `checkDigest`, `producer: {name, version}`, and optional `artifactPaths`, `runId`, and `detail`. It rejects mismatching current inputs, hashes referenced local artifacts, preserves an immutable run receipt, and updates current results. Reuse the same run ID for retry; different evidence under that ID is refused. Producer attribution is not cryptographic authentication of a test run.

Declare exact generated evidence filenames in `ledger.json.generatedArtifactPaths` before capturing the fingerprint. Only non-source files under `docs/workstreams/<workstream>/evidence/<run>/` qualify; merely placing a file in that directory never excludes it. Retain declarations for historical outputs. Artifacts are hashed separately, and missing, changed, or escaping required artifacts yield missing evidence. Remote links can remain optional references; required remote artifacts need an observable local copy before they can support verification.

Code-break reviews and scope approvals use the same current-content fingerprint. A content-preserving commit keeps them current; a later source edit does not. Historical close-time digests cannot authorize new content.
