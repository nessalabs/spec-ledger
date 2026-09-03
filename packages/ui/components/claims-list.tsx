"use client"

import Link from "next/link"
import type { Claim, EvidenceBinding } from "@nessa/spec-ledger-client"
import { cn } from "@/lib/cn"

const outcomeClass: Record<string, string> = {
  pass: "text-emerald-400",
  fail: "text-red-400",
  missing: "text-amber-400",
  unbound: "text-amber-400",
  attested: "text-muted-foreground",
}

type Outcome = keyof typeof outcomeClass

export function ClaimsList({
  claims,
  bindings,
  verdicts,
}: {
  claims: Claim[]
  bindings: EvidenceBinding[]
  verdicts: Array<{ claimId: string; outcome: Outcome; detail?: string }>
}) {
  const verdict = new Map(verdicts.map((c) => [c.claimId, c]))
  const bindingCount = new Map<string, number>()
  for (const b of bindings) {
    bindingCount.set(b.claimId, (bindingCount.get(b.claimId) ?? 0) + 1)
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {claims.map((claim) => {
        const v = verdict.get(claim.id)
        const n = bindingCount.get(claim.id) ?? 0
        const docs = claim.links?.docs?.[0]
        return (
          <li key={claim.id}>
            <Link
              href={`/claims/${encodeURIComponent(claim.id)}`}
              className="grid gap-1 px-3 py-2.5 no-underline transition-colors hover:bg-muted/40 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-3"
            >
              <span className="font-mono text-xs font-semibold text-foreground">
                {claim.id}
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm leading-snug text-foreground/90">
                  {claim.statement}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>{claim.kind}</span>
                  {claim.required ? <span>required</span> : <span>optional</span>}
                  <span>
                    {n} binding{n === 1 ? "" : "s"}
                  </span>
                  {docs ? (
                    <span className="font-mono truncate" title={docs}>
                      {docs}
                    </span>
                  ) : null}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium capitalize sm:text-right",
                  v ? outcomeClass[v.outcome] : "text-muted-foreground",
                )}
              >
                {v?.outcome ?? "—"}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
