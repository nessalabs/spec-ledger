"use client"

import {
  DiffStat,
  FileDiffCard,
  FileDiffCardActions,
  FileDiffCardHeader,
  FileDiffCardHeading,
  FileDiffCardTitle,
  FileDiffList,
  FileDiffListItem,
  FileDiffListToggle,
  FileDiffPath,
} from "@nessa-ui/react"
import type { Turn } from "@nessa/spec-ledger-client"
import { splitTurnFiles } from "@/lib/impact"

type TurnFile = NonNullable<Turn["facts"]>["files"][number]

export function TurnFilesCard({ files }: { files: TurnFile[] }) {
  const { product, ledger } = splitTurnFiles(files)
  const shown = product.length ? product : files
  const additions = shown.reduce((n, f) => n + (f.additions ?? 0), 0)
  const deletions = shown.reduce((n, f) => n + (f.deletions ?? 0), 0)
  const sorted = [...shown].sort((a, b) => a.path.localeCompare(b.path))

  if (!sorted.length) return null

  return (
    <FileDiffCard
      defaultExpanded={false}
      collapsedCount={5}
      itemCount={sorted.length}
    >
      <FileDiffCardHeader>
        <FileDiffCardHeading>
          <FileDiffCardTitle>
            {product.length ? "Changed files" : "Ledger files"}
          </FileDiffCardTitle>
        </FileDiffCardHeading>
        <FileDiffCardActions>
          <DiffStat additions={additions} deletions={deletions} />
        </FileDiffCardActions>
      </FileDiffCardHeader>
      <FileDiffList>
        {sorted.map((f) => (
          <FileDiffListItem key={f.path}>
            <FileDiffPath path={f.path} />
            <span className="text-[11px] capitalize text-muted-foreground">
              {f.kind}
            </span>
            <DiffStat
              additions={f.additions ?? 0}
              deletions={f.deletions ?? 0}
            />
          </FileDiffListItem>
        ))}
      </FileDiffList>
      <FileDiffListToggle />
      {product.length && ledger.length ? (
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          +{ledger.length} ledger record{ledger.length === 1 ? "" : "s"} not listed
        </p>
      ) : null}
    </FileDiffCard>
  )
}
