import type { GoalProjection } from "@nessalabs/spec-ledger-client"
export function formatMeasurement(value: number | undefined | null): string
export function experimentChart(projection: GoalProjection, width?: number, height?: number): null | {
  width: number; height: number; margin: { left: number; right: number; top: number; bottom: number }
  points: Array<{ id: string; number: number; x: number; y: number | null; value: number | undefined; decision: string | undefined }>
  segments: number[][][]; ticks: Array<{ value: number; y: number }>; baselineY: number | null; targetY: number | null
}
