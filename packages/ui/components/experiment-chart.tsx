import type { GoalProjection } from "@nessalabs/spec-ledger-client"
import { experimentChart, formatMeasurement } from "@/lib/experiment-chart.mjs"

export function ExperimentChart({ projection }: { projection: GoalProjection }) {
  const metric = projection.goal.metric
  if (!metric) return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">This goal tracks qualitative improvement. Follow each experiment’s findings below.</div>
  const chart = experimentChart(projection)
  if (!chart) return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No measurements yet. The first reported result will appear here.</div>
  const { width, height, margin } = chart
  return <div>
    <div className="overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible" style={{ minWidth: 560 }} role="img" aria-label={`${metric.name} by experiment. ${metric.direction === "minimize" ? "Lower" : "Higher"} is better. Missing measurements break the line. All values are also in the results table.`}>
      {chart.ticks.map(tick => <g key={tick.value}>
        <line x1={margin.left} x2={width - margin.right} y1={tick.y} y2={tick.y} stroke="currentColor" className="text-border" />
        <text x={margin.left - 12} y={tick.y + 4} textAnchor="end" fill="currentColor" className="text-muted-foreground" fontSize="11">{formatMeasurement(tick.value)}</text>
      </g>)}
      {chart.targetY !== null && <line x1={margin.left} x2={width - margin.right} y1={chart.targetY} y2={chart.targetY} stroke="currentColor" strokeDasharray="5 5" className="text-emerald-600 dark:text-emerald-400" />}
      {chart.baselineY !== null && <line x1={margin.left} x2={width - margin.right} y1={chart.baselineY} y2={chart.baselineY} stroke="currentColor" strokeDasharray="2 5" className="text-muted-foreground" />}
      {chart.segments.map((segment, i) => <polyline key={i} points={segment.map(p => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400" />)}
      {chart.points.filter(point => point.y !== null).map(point => <g key={point.id}>
        <circle cx={point.x} cy={point.y!} r={5} fill={point.decision === "kept" ? "currentColor" : "var(--background)"} stroke="currentColor" strokeWidth="2" className="text-indigo-600 dark:text-indigo-400"><title>{`#${point.number} · ${point.id}: ${formatMeasurement(point.value)} ${metric.unit} · ${point.decision}`}</title></circle>
      </g>)}
      <text x={margin.left} y={height - 12} fill="currentColor" className="text-muted-foreground" fontSize="11">{metric.baseline === undefined ? "Start" : "Baseline"}</text>
      {chart.points.filter((_, i, a) => a.length <= 12 || i === a.length - 1 || i % Math.ceil(a.length / 10) === 0).map(point => <text key={point.id} x={point.x} y={height - 12} textAnchor="middle" fill="currentColor" className="text-muted-foreground" fontSize="11">#{point.number}</text>)}
    </svg></div>
    <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <span><span className="text-indigo-600 dark:text-indigo-400">●</span> Kept <span className="ml-2 text-indigo-600 dark:text-indigo-400">○</span> Other measured results</span>
      {metric.baseline !== undefined && <span>··· Baseline {formatMeasurement(metric.baseline)} {metric.unit}</span>}
      {metric.target !== undefined && <span className="text-emerald-700 dark:text-emerald-400">– – Target {formatMeasurement(metric.target)} {metric.unit}</span>}
      <span>Gaps = no measurement · ordered by attempt</span>
    </div>
  </div>
}
