import nextDynamic from "next/dynamic"
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CodeBlock,
} from "@nessalabs/ui"
import { serverClient } from "@/lib/ledger"
import { HTTP_CONTRACT } from "@nessalabs/spec-ledger-client"

const ContractsExplorer = nextDynamic(
  () =>
    import("@/components/contracts-explorer").then((m) => m.ContractsExplorer),
  {
    loading: () => (
      <div className="rounded-xl border border-border p-8 text-sm text-muted-foreground">
        Loading schemas…
      </div>
    ),
  },
)

export const dynamic = "force-dynamic"

export default async function ContractsPage() {
  const client = serverClient()
  const names = await client.listSchemas()
  const schemas: Record<string, unknown> = {}
  await Promise.all(
    names.map(async (name) => {
      schemas[name] = await client.getSchema(name)
    }),
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Contracts
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Spec Ledger’s own contracts
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          JSON Schema files under <code className="text-foreground">schemas/</code> are
          the SSOT for claims, bindings, results, reports, and the graph. The HTTP
          API is read-only (SL-003) — embedders use{" "}
          <code className="text-foreground">@nessalabs/spec-ledger-client</code>.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>HTTP API (read-only)</CardTitle>
          <CardDescription>
            No write endpoints. Mutating methods return 405.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Method</th>
                  <th className="py-2 pr-4 font-medium">Path</th>
                  <th className="py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {HTTP_CONTRACT.map((row) => (
                  <tr key={row.path} className="border-b border-border/60">
                    <td className="py-2 pr-4">
                      <Badge variant="outline">{row.method}</Badge>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{row.path}</td>
                    <td className="py-2 text-muted-foreground">{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client embed snippet</CardTitle>
          <CardDescription>Third-party UIs depend on the client, not this app.</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock
            language="ts"
            mode="dark"
            code={`import { createSpecLedgerClient } from "@nessalabs/spec-ledger-client"

const client = createSpecLedgerClient({
  kind: "http",
  baseUrl: "http://127.0.0.1:8787/",
})

const snap = await client.getSnapshot()
const schemas = await client.listSchemas()`}
          />
        </CardContent>
      </Card>

      <ContractsExplorer schemas={schemas} />
    </div>
  )
}
