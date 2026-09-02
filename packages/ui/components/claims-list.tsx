"use client"

import { Badge, Card, CardContent } from "@nessa-ui/react"
import type { Claim, EvidenceBinding } from "@nessa/spec-ledger-client"

const outcomeVariant = {
  pass: "default",
  fail: "destructive",
  missing: "outline",
  unbound: "outline",
  attested: "secondary",
} as const

type Outcome = keyof typeof outcomeVariant

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
    <div className="flex flex-col gap-3">
      {claims.map((claim) => {
        const v = verdict.get(claim.id)
        const n = bindingCount.get(claim.id) ?? 0
        return (
          <Card key={claim.id} className="gap-0 py-0">
            <CardContent className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{claim.id}</span>
                <Badge variant="outline">{claim.kind}</Badge>
                {claim.required ? <Badge>required</Badge> : null}
                {v ? (
                  <Badge variant={outcomeVariant[v.outcome] ?? "outline"}>
                    {v.outcome}
                  </Badge>
                ) : null}
                <span className="font-mono text-[10px] text-muted-foreground">
                  {n} binding{n === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {claim.statement}
              </p>
              {claim.links?.docs?.length ? (
                <p className="font-mono text-[11px] text-muted-foreground/80">
                  {claim.links.docs.join(" · ")}
                </p>
              ) : null}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
