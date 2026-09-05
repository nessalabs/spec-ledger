# Permission and correction context

Intent, permission, and evidence are separate records. `spec-ledger plan --workstream W-001` shows the current plan, related context, permission, and next action. `work --workstream W-001 --slice SLC-01 --goal "…"` is the portable entry point for opening an implementing turn. Existing commands remain available.

Use `permission status --workstream W-001` to inspect the exact revision fingerprint. Approval and denial require that fingerprint:

```sh
spec-ledger permission approve --workstream W-001 --revision <digest> --source 'User approved this revision in the current conversation'
spec-ledger permission delegate --workstream W-001 --features verify,cli --source 'User delegated this request'
spec-ledger permission delegate --features verify,cli --exclude-features payments --source 'User delegated these features until revoked'
spec-ledger permission deny --workstream W-001 --revision <digest> --source 'User rejected this revision'
spec-ledger permission revoke --id AUTH-… --source 'User revoked this delegation'
```

The portable CLI records **agent-reported provenance**. A string naming a human or host is not authenticated consent. The local UI host now invokes the shared writer directly through its bounded approval adapter. Other hosts can use the portable CLI handoff. Both show a saved decision only after persistence; neither authenticates a human identity.

Authority records are append-only. Revision approval covers the exact current spec body and document. Request delegation is scoped to one workstream; standing delegation is limited to named feature IDs. Explicit exclusions and request restrictions are checked mechanically. Semantic fit within a user's instruction still requires agent/reviewer judgment. Request authority does not silently fall back to a broader grant. Denial pins both the rejected revision and its active delegation, so the same delegation cannot restart that work by rewriting its plan. A new explicit approval can name `--supersedes AUTH-…` to resolve a denial. Revocation never erases history.

Work entry checks current authority and preserves a plan snapshot before coding. Delegated snapshots name `agent:permission:<authority-id>`; they never impersonate a human seal. Existing historical seals remain a compatibility path labeled unverified. Completion checks authority again. Read operations never create snapshots. A revocation cannot stop a command already executing outside the ledger; the next dependent ledger transition is denied.

`permission record --file authority.json` supports explicit request restrictions and retryable caller-supplied IDs. `learning record --file correction.json` records a statement, source, optional workstream/feature scope, and optional superseded learning or tenet IDs. Source kind is `user-reported` or `agent-inferred`. Only scoped user-reported corrections enter active context; inferred preferences remain unconfirmed. A scoped supersession removes old guidance only within its applicable context. The context digest hashes the supplied contents, including corrections and check definitions, rather than only their IDs.

## Local browser host

The user-selected local UI host uses the same permission writer through a bounded approval adapter; see [session](session.md). The generic projection server remains read-only. A browser action records a revision decision, not broader request or standing delegation, and is not authenticated user identity.
