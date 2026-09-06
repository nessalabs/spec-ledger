# Generated identities

Spec Ledger generates opaque UUIDs for workstreams, slices, turns, claims, bindings, reviews and findings, goals and experiments, workflows, authority, compass records, and episode records. People supply a short title or statement. Two records can have the same title and remain distinct.

Create a draft through `spec-ledger workstream create --file draft.json`, or the MCP `create_workstream` operation. The input contains `title`, `problem`, `objective`, existing graph `featureIds`, and optionally `suggestedSlices` with titles and acceptance. Omit all IDs. Keep the returned workstream and slice IDs for subsequent operations.

The same rule applies to `claim create`, `claim propose`, `binding create`, `tenet create`, `theme create`, `learning record`, `goal create`, `experiment start`, review recording and workflow saving. Live claims and bindings require an authorized open turn; proposing work does not grant permission to build. Public operations reject chosen record IDs where an identity would otherwise be supplied, and generate nested identities. A caller-stable `requestId` correlates a retry; a new request creates a new record even when its title is identical.

UUID filenames and atomic publication prevent one newly created entity from replacing another. Revision numbers and attempt sequences still represent order. Graph feature/node keys and local skill keys remain authored vocabulary. UI headings use titles; reference details expose UUIDs.

## Migrating existing histories

`spec-ledger identity migrate --stage /absolute/external/staging --base <commit> --ours <commit> --theirs <commit>` stages a migration outside the live checkout. Use immutable Git commits. The staging descriptor freezes resolved commits; moving a supplied branch causes a retry to fail rather than reuse bytes under another identity.

The tool separates independent entities from shared ancestry, rewrites references and paths, preserves original hashes and commits in its manifest, refreshes affected snapshot/reference hashes and validates the result. Historical execution fingerprints and outcomes stay historical. A migration is not fresh evidence or approval.

Conflicts require explicit `--resolutions <json>`. Pre-existing malformed links can be reconciled using `--reconciliations <json>`: each entry names a file, an array of field keys, the exact `before` and `after` values, and a reason. The manifest retains these changes alongside original hashes. Failed preconditions stop staging.

After inspecting the staged output and manifest, publish with `spec-ledger identity migrate --stage /absolute/external/staging --publish`. Publication validates exact staged inventory and hashes, rejects symlink redirects, and keeps the original live files in `live-backup` with a recovery journal. Interrupted copies rebuild a clean pending directory; completed retries refuse to replace subsequently changed live files. Preserve every origin commit in the integration commit's ancestry. There is no runtime numbered-ID compatibility layer.
