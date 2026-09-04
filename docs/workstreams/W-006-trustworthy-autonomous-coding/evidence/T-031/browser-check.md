# Browser observations — T-031

Observed locally on 2026-09-04 using the in-app browser. These are manual observations by the agent, not a host-authenticated approval or an automated browser CI suite.

- Reported turn T-021 at 655px viewport: collapsed rail x=0,width=56; page x=56,width=599; heading x=80,width=551; document scroll width=655. Heading and content are visible without rail overlap. Opening and closing the navigation restores this state.
- Live session at the real checkout, port3737: goal, permission provenance, acceptance, meaningful decisions, and unavailable preview are displayed. Polling updates the observation time.
- Approve via CLI displays the current revision command and explicitly states no decision was saved by the button.
- Stopping the separate temporary server switches the retained session to “Disconnected · showing last observation”. The real checkout server was restored and remains running.
- Isolated mixed-state session: one of three criteria has passing evidence. Invite teammate is implemented/pass; tenant isolation is implemented/fail; expired invitation is unconfirmed/missing. The activated isolation deferral appears under Needs attention together with the failing criterion. The preview is explicitly availability-unconfirmed.
- Incomplete fixture graph (missing layers and system) now displays Graph unavailable with an incomplete-data explanation, without attempting Mermaid rendering. The real checkout graph renders five nodes, five edges, and its layer map.

The viewport control timed out when additional breakpoint checks were attempted; 375/767/768px are not claimed as tested. The viewport remained655px after recovery. This artifact is explicitly declared generated evidence so writing the observation does not itself change the source fingerprint. The original user screenshots remain source observations outside that exclusion.
