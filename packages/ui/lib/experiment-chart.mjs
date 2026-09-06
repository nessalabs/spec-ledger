/** Attempt-order geometry. Missing measurements break the line; they never become zero. */
export function experimentChart(projection, width = 880, height = 250) {
  const metric = projection.goal.metric
  const margin = { left: 72, right: 30, top: 24, bottom: 38 }
  const values = projection.experiments.flatMap(({ result }) => result?.status === "completed" && result.measurement !== undefined ? [result.measurement] : [])
  if (metric?.baseline !== undefined) values.push(metric.baseline)
  if (metric?.target !== undefined) values.push(metric.target)
  if (!values.length) return null
  // Normalize before subtraction so all finite input values produce finite SVG coordinates.
  const scale = Math.max(1, ...values.map(v => Math.abs(v)))
  const normalized = values.map(v => v / scale)
  let low = Math.min(...normalized), high = Math.max(...normalized)
  if (low === high) { low -= 0.1; high += 0.1 }
  const range = high - low
  low -= range * 0.1; high += range * 0.1
  const x = index => margin.left + index / Math.max(1, projection.experiments.length) * (width - margin.left - margin.right)
  const y = value => margin.top + (high - value / scale) / (high - low) * (height - margin.top - margin.bottom)
  const points = projection.experiments.map(({ experiment, result }, index) => ({
    id: experiment.id, number: index + 1, x: x(index + 1),
    value: result?.status === "completed" ? result.measurement : undefined,
    y: result?.status === "completed" && result.measurement !== undefined ? y(result.measurement) : null,
    decision: result?.decision,
  }))
  let segments = [], current = []
  if (metric?.baseline !== undefined) current.push([x(0), y(metric.baseline)])
  for (const point of points) {
    if (point.y === null) { if (current.length) segments.push(current); current = [] }
    else current.push([point.x, point.y])
  }
  if (current.length) segments.push(current)
  return {
    width, height, margin, points, segments,
    // Values used for ticks stay inside the original finite extent.
    ticks: [0, 0.5, 1].map(f => {
      const normalizedValue = Math.min(...normalized) * (1 - f) + Math.max(...normalized) * f
      const value = normalizedValue * scale
      return { value, y: y(value) }
    }).filter((tick, index, all) => index === all.findIndex(t => t.value === tick.value)),
    baselineY: metric?.baseline === undefined ? null : y(metric.baseline),
    targetY: metric?.target === undefined ? null : y(metric.target),
  }
}
export function formatMeasurement(value) {
  if (value === undefined || value === null) return "—"
  if (value !== 0 && (Math.abs(value) < 0.0001 || Math.abs(value) >= 10000000)) return value.toExponential(2)
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value)
}
