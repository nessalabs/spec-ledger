"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  JsonTree,
  SegmentedControl,
  SegmentedControlOption,
} from "@nessalabs/ui"

export function ContractsExplorer({
  schemas,
}: {
  schemas: Record<string, unknown>
}) {
  const names = Object.keys(schemas).sort()
  const [selected, setSelected] = React.useState(names[0] ?? "")
  const doc = selected ? schemas[selected] : null

  if (names.length === 0) {
    return <p className="text-sm text-muted-foreground">No schemas found.</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>JSON Schema SSOT</CardTitle>
        <CardDescription>
          Browse the contract documents that define claim, binding, results, report,
          graph, and ledger root shapes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SegmentedControl
          aria-label="Schema file"
          value={selected}
          onValueChange={setSelected}
          className="flex-wrap"
        >
          {names.map((name) => (
            <SegmentedControlOption key={name} value={name}>
              {name.replace(/\.json$/, "")}
            </SegmentedControlOption>
          ))}
        </SegmentedControl>
        {doc ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
            <JsonTree value={doc} defaultExpandedDepth={2} collapsible />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
