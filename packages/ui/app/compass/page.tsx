import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nessalabs/ui"
import { serverClient } from "@/lib/ledger"

export const dynamic = "force-dynamic"

export default async function CompassPage() {
  const client = serverClient()
  const [{ vision, tenets, themes }, proposed] = await Promise.all([
    client.getCompass(),
    client.getProposedClaims(),
  ])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Compass
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Vision & weighing rules</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Not verify truth — standing north star, tenets, and themes that shape workstreams.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Vision</CardTitle>
          <CardDescription>Product north star</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {vision ? (
            <>
              <p className="leading-relaxed">{vision.summary}</p>
              {vision.northStar ? (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">North star · </span>
                  {vision.northStar}
                </p>
              ) : null}
              {vision.nonGoals?.length ? (
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {vision.nonGoals.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">No vision.json yet.</p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Tenets</h2>
        {tenets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active tenets.</p>
        ) : (
          tenets.map((t) => (
            <Card key={t.id}>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {t.id}
                  </Badge>
                  {t.weight ? <Badge variant="secondary">{t.weight}</Badge> : null}
                  <Badge variant="outline">{t.origin}</Badge>
                </div>
                <CardDescription className="text-sm text-foreground">
                  {t.statement}
                </CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Themes</h2>
        {themes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No themes.</p>
        ) : (
          themes.map((th) => (
            <Card key={th.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{th.title}</CardTitle>
                  <Badge variant="outline" className="font-mono">
                    {th.id}
                  </Badge>
                </div>
                <CardDescription>{th.summary}</CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Proposed claims</h2>
        {proposed.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {proposed.map((p) => (
              <li key={p.id} className="rounded-md border border-border px-3 py-2">
                <span className="font-mono text-xs">{p.id}</span>{" "}
                <Badge variant="secondary">{p.status}</Badge>
                <p className="mt-1 text-muted-foreground">{p.statement}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
