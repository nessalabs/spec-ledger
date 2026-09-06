
import { ReadableText } from "@/components/readable-text"
import Link from "next/link"
import type { GoalProjection } from "@nessalabs/spec-ledger-client"
export function GoalLinks({ goals }: { goals: GoalProjection[] }) {
  if (!goals.length) return null
  return <section className="my-4 rounded-xl border border-border p-4"><h2 className="text-xs font-semibold">Iterative improvement</h2><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{goals.map(p => <Link key={p.goal.id} href={`/experiments/${p.goal.id}`} className="text-sm"><ReadableText>{p.goal.title}</ReadableText> <span className="text-xs text-muted-foreground">· {p.experiments.length} experiments</span></Link>)}</div></section>
}
