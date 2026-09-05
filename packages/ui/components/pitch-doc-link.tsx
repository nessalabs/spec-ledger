"use client"

import { Button } from "@nessalabs/ui"
import { useDocPane } from "@/components/turn-doc-split"

/** Compact pitch row: path + Read opens SplitView (no inline Markdown). */
export function PitchDocLink({
  path,
  title,
}: {
  path: string
  title?: string
}) {
  const { openDoc, openPath } = useDocPane()
  const open = openPath === path

  return <Button variant="outline" type="button" onClick={() => openDoc({ path, label: title ?? "Spec" })} className="self-start text-sm font-medium underline underline-offset-4">{open ? "Spec is open" : "Read spec"}</Button>
}
