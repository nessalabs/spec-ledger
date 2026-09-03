import Link from "next/link"
import {
  Badge,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nessa-ui/react"
import { serverClient } from "@/lib/ledger"

export const dynamic = "force-dynamic"

export default async function WorkstreamsPage() {
  const client = serverClient()
  const workstreams = await client.listWorkstreams()
  const ordered = [...workstreams].sort((a, b) => b.id.localeCompare(a.id))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Workstreams
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Bets</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Sealed (or shaped) verticals. Spec Ledger never verifies workstream
          files into ledgerDigest.
        </p>
      </header>

      <section className="space-y-3">
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workstreams yet.</p>
        ) : (
          ordered.map((w) => (
            <Card key={w.id}>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/workstreams/${w.id}`}
                    className="font-mono text-base font-semibold no-underline hover:underline"
                  >
                    {w.id}
                  </Link>
                  <Badge variant="outline">{w.status}</Badge>
                  {w.seal ? (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      rev {w.seal.revision} · {w.seal.specDigest.slice(0, 12)}…
                    </Badge>
                  ) : null}
                </div>
                <CardTitle className="text-base font-medium">{w.title}</CardTitle>
                <CardDescription>{w.problem}</CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </section>
    </div>
  )
}
