"use client"

import { ReadableText } from "@/components/readable-text"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@nessalabs/ui"
import { ArrowLeft, RefreshCw } from "lucide-react"
import type { GoalProjection, Observation } from "@nessalabs/spec-ledger-client"
import { ExperimentChart } from "./experiment-chart"
import { formatMeasurement } from "@/lib/experiment-chart.mjs"

const stateLabel = { active: "In progress", "budget-reached": "Experiment budget reached", concluded: "Concluded" }
function observedLabel(observation: Observation | null) {
  return !observation ? "No measurement" : observation.experimentId ? `Measured experiment · ${observation.decision}` : "Starting baseline"
}
export function ExperimentInspect({ initial, capturedAt }: { initial: GoalProjection; capturedAt: string }) {
  const [projection, setProjection] = useState(initial)
  const [readAt, setReadAt] = useState(capturedAt)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [limit, setLimit] = useState(20)
  const busy = useRef(false)
  const mounted = useRef(true)
  const activeRequest = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true; setRefreshing(true)
    const controller = new AbortController()
    activeRequest.current = controller
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(`/api/goals/${encodeURIComponent(initial.goal.id)}`, { cache: "no-store", signal: controller.signal })
      if (!response.ok) throw new Error("Unable to refresh. Showing the last readable snapshot.")
      const data = await response.json() as { projection: GoalProjection; capturedAt: string }
      if (mounted.current) { setProjection(data.projection); setReadAt(data.capturedAt); setError(null) }
    } catch (failure) { if (mounted.current) setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "Refresh timed out. Showing the last readable snapshot.") }
    finally { clearTimeout(timeout); activeRequest.current = null; busy.current = false; if (mounted.current) setRefreshing(false) }
  }, [initial.goal.id])
  useEffect(() => {
    mounted.current = true
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh() }, 5000)
    return () => { mounted.current = false; clearInterval(timer); activeRequest.current?.abort() }
  }, [refresh])
  const { goal, experiments } = projection
  const metric = goal.metric
  const pending = experiments.filter(e => !e.result).length
  const latestFinding = [...experiments].reverse().find(e => e.result)?.result
  const cards = metric ? [
    { label: "Baseline", value: metric.baseline, detail: "Starting measurement" },
    { label: "Latest measured attempt", value: projection.latest?.value, detail: observedLabel(projection.latest) },
    { label: "Best observed", value: projection.bestObserved?.value, detail: observedLabel(projection.bestObserved) },
    { label: "Best kept", value: projection.bestKept?.value, detail: observedLabel(projection.bestKept) },
  ] : []
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <header className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <Link href="/experiments" className="inline-flex items-center gap-1.5 no-underline hover:text-foreground"><ArrowLeft className="size-3.5" /> Experiments</Link>
        <div className="flex items-center gap-3"><span>Snapshot {new Date(readAt).toISOString().replace("T", " ").slice(0,19)} UTC</span><Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}><RefreshCw className={`mr-1 size-3.5 ${refreshing ? "animate-spin" : ""}`} />Refresh</Button></div>
      </div>
      {error && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><ReadableText>{error}</ReadableText></p>}
      <div className="flex flex-wrap items-center gap-3"><Badge variant="outline">Iterative improvement</Badge><Badge variant="outline">{stateLabel[projection.status]}</Badge><span className="text-xs text-muted-foreground"><Link href={`/workstreams/${goal.workstreamId}`}><ReadableText>{goal.workstreamId}</ReadableText></Link> · started in <Link href={`/turns/${goal.turnId}`}><ReadableText>{goal.turnId}</ReadableText></Link></span></div>
      <h1 className="text-3xl font-semibold tracking-tight"><ReadableText>{goal.title}</ReadableText></h1>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground"><ReadableText>{goal.objective}</ReadableText></p>
    </header>
    <section className="grid gap-4 rounded-xl border border-border bg-muted/25 p-4 text-sm md:grid-cols-[1fr_auto]">
      <div><p className="mb-1 text-xs font-medium text-muted-foreground">Stop when</p><p><ReadableText>{goal.stopWhen}</ReadableText></p></div>
      <div className="md:border-l md:border-border md:pl-6"><p className="font-semibold">{experiments.length}{goal.maxExperiments ? ` / ${goal.maxExperiments}` : ""} experiments</p><p className="mt-1 text-xs text-muted-foreground">{pending} pending · {experiments.filter(e => e.result?.status === "failed").length} failed{projection.remainingExperiments !== null ? ` · ${projection.remainingExperiments} remaining` : ""}</p></div>
    </section>
    {metric && <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>{cards.map(card => <div key={card.label} className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground"><ReadableText>{card.label}</ReadableText></p><p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{formatMeasurement(card.value)} <span className="text-sm font-normal text-muted-foreground">{card.value !== undefined && card.value !== null ? metric.unit : ""}</span></p><p className="mt-1 break-words text-xs text-muted-foreground"><ReadableText>{card.detail}</ReadableText></p></div>)}</div>}
    <section className="rounded-xl border border-border p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{metric ? `${metric.name} over experiments` : "Experiment findings"}</h2><span className="text-xs text-muted-foreground">{metric ? `${metric.direction === "minimize" ? "Lower" : "Higher"} is better` : "Qualitative goal"}{projection.targetObserved !== null ? projection.targetObserved ? " · Target observed" : " · Target not yet observed" : ""}</span></div>
      <ExperimentChart projection={projection} />
      {metric && <details className="mt-4 text-xs text-muted-foreground"><summary className="cursor-pointer">Evaluation protocol</summary><p className="mt-2 whitespace-pre-wrap leading-relaxed"><ReadableText>{metric.protocol}</ReadableText></p></details>}
    </section>
    {(projection.conclusion || latestFinding) && <section className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4"><h2 className="text-xs font-semibold">{projection.conclusion ? `Conclusion · ${projection.conclusion.reason}` : "Latest finding"}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed"><ReadableText>{projection.conclusion?.summary ?? latestFinding?.findings}</ReadableText></p></section>}
    <section className="space-y-3">
      <div className="flex items-baseline justify-between"><h2 className="text-sm font-semibold">Experiment results</h2><p className="text-xs text-muted-foreground">Newest attempts first</p></div>
      {!experiments.length ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No experiments started. The agent can record a hypothesis and change when ready.</div> : <div className="overflow-x-auto rounded-xl border border-border"><Table>
        <TableHeader><TableRow><TableHead className="w-16">Attempt</TableHead><TableHead>Hypothesis & change</TableHead><TableHead>Result</TableHead><TableHead>Decision</TableHead><TableHead className="min-w-64">Findings</TableHead></TableRow></TableHeader>
        <TableBody>{[...experiments].reverse().slice(0,limit).map(({ experiment, result }) => <TableRow key={experiment.id}>
          <TableCell className="align-top"><p className="font-medium">#{experiment.sequence}</p><Link className="mt-1 block text-xs text-muted-foreground" href={`/turns/${experiment.turnId}`}><ReadableText>{experiment.turnId}</ReadableText></Link></TableCell>
          <TableCell className="min-w-64 max-w-96 whitespace-normal align-top"><p className="text-sm font-medium"><ReadableText>{experiment.hypothesis}</ReadableText></p><p className="mt-1 text-xs leading-relaxed text-muted-foreground"><ReadableText>{experiment.change}</ReadableText></p><p className="mt-2 break-all text-[10px] text-muted-foreground">{experiment.parentExperimentId ? `Builds on experiment ${experiments.find(item => item.experiment.id === experiment.parentExperimentId)?.experiment.sequence ?? "not available"}` : ""}</p></TableCell>
          <TableCell className="whitespace-nowrap align-top text-sm tabular-nums">{!result ? <Badge variant="outline">Pending</Badge> : result.status === "failed" ? <Badge variant="outline">Failed</Badge> : result.measurement === undefined ? "No measurement" : `${formatMeasurement(result.measurement)} ${metric?.unit ?? ""}`}</TableCell>
          <TableCell className="align-top"><span className={`text-xs ${result?.decision === "kept" ? "font-medium text-indigo-700 dark:text-indigo-300" : "text-muted-foreground"}`}>{result?.decision ?? "Undecided"}</span></TableCell>
          <TableCell className="max-w-md whitespace-normal align-top text-xs leading-relaxed"><p><ReadableText>{result?.findings ?? "Awaiting a reported result."}</ReadableText></p>{result?.evidenceRefs?.length ? <details className="mt-2 text-muted-foreground"><summary className="cursor-pointer">Evidence references ({result.evidenceRefs.length})</summary><ul className="mt-2 space-y-1">{result.evidenceRefs.map((ref,i) => <li key={i} className="break-all"><ReadableText>{ref}</ReadableText></li>)}</ul></details> : null}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>}
      {experiments.length > limit && <Button variant="outline" size="sm" onClick={() => setLimit(n => n + 20)}>Show more experiments ({experiments.length - limit} remaining)</Button>}
    </section>
    <footer className="flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground"><p>Agent-reported observations · kept means reported retained, not verified or currently deployed.<br />Existing task reviews and verification still apply.</p><p>Last record: {projection.lastRecordedAt.replace("T", " ").slice(0,19)} UTC<br />Refreshes every 5 seconds while visible.</p></footer>
  </div>
}
