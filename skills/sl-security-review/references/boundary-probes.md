# Boundary probes

Choose rows supported by the application's threat model. These are test ideas,
not assertions that any installed framework is vulnerable.

| Boundary | Invariant and useful negative cases |
| --- | --- |
| Restricted credentials | Restrictions survive every route and delegated operation. Trace read-only/admin combinations through uploads, jobs, hooks, impersonation, and session creation; check actual side effects. |
| JWT/JWKS | Server policy selects permitted algorithms and compatible keys. Test absent configuration, missing key metadata, unsupported algorithms, wrong issuer/audience, expired tokens, and cross-application tokens. Use the protocol/provider's current documentation as the oracle. |
| Signed cookies/key rotation | Acceptance requires a successful verification by an allowed key. Test no matching key, malformed signature, empty key set, first/last matching key, and equivalent interpreted/compiled paths where present. |
| Tenant/object authorization | Every read, mutation, export, and queued job is bound to the authorized principal and tenant. Swap object identifiers and compare real persistence/results across two synthetic tenants. |
| Egress controls | Distinguish promised observation from promised prevention. Check supported protocols and alternate send paths in an isolated fixture; do not infer a blocking bypass from a missing audit event. |
| Parsers/files/processes | Trace decoding and normalization to the actual sink. Test boundary values, conflicting representations, traversal and symlink handling where relevant; use bounded local harnesses. Differential/fuzz output needs a contract-based oracle and a minimized reproducible case. |
| Agent/tool boundaries | Retrieved text must not grant tool authority. Test whether untrusted content can change an action's principal, destination, or approval requirement using inert fixtures. This is a product threat distinct from adversarial prompting of the reviewer. |

After a confirmed defect, check sibling paths sharing the faulty enforcement
within the review budget. Do not infer the same flaw merely from similar names.
