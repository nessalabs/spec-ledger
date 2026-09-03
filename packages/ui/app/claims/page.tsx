import { ClaimsList } from "@/components/claims-list"
import { liveReport, serverClient } from "@/lib/ledger"

export const dynamic = "force-dynamic"

export default async function ClaimsPage() {
  const client = serverClient()
  const [claims, bindings, report] = await Promise.all([
    client.getClaims(),
    client.getBindings(),
    liveReport(),
  ])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Claims
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">What must stay true</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Standing truths and their live verify outcome. Open a row for bindings.
        </p>
      </header>

      <ClaimsList
        claims={claims}
        bindings={bindings}
        verdicts={report.claims.map((c) => ({
          claimId: c.claimId,
          outcome: c.outcome as
            | "pass"
            | "fail"
            | "missing"
            | "unbound"
            | "attested",
          detail: c.detail,
        }))}
      />
    </div>
  )
}
