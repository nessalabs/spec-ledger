/** Display names only. Keys remain opaque identities in storage, links and operations. */
export type RecordLabels = Record<string, string>
const identity = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/AC-\d+)?/gi

export function readableText(value: string | null | undefined, labels: RecordLabels = {}, fallback = "Related record"): string {
  return (value ?? "").replace(identity, id => {
    const label = labels[id]
    // Labels may themselves contain historical references. Never recurse through a cycle.
    return label ? label.replace(identity, fallback) : fallback
  })
}

/** Preserve markdown destinations and code/source blocks while naming prose references. */
export function readableMarkdown(value: string, labels: RecordLabels): string {
  return value.split(/(```[\s\S]*?```|\]\([^\n)]*\))/g).map((part, index) => index % 2 ? part : readableText(part, labels)).join("")
}

export function buildRecordLabels(records: {
  claims: Array<{id:string;statement:string}>
  turns: Array<{id:string;intent:{restatedGoal:string}}>
  workstreams: Array<{id:string;title:string;suggestedSlices?:Array<{id:string;title:string;acceptance:string[]}>}>
  bindings?: Array<{id:string;test?:{description?:string}}>
}): RecordLabels {
  const labels: RecordLabels = {}
  for (const claim of records.claims) labels[claim.id] = claim.statement
  for (const turn of records.turns) labels[turn.id] = turn.intent.restatedGoal
  for (const work of records.workstreams) {
    labels[work.id] = work.title
    for (const slice of work.suggestedSlices ?? []) {
      labels[slice.id] = slice.title
      slice.acceptance.forEach((text, index) => { labels[`${slice.id}/AC-${index + 1}`] = text })
    }
  }
  for (const binding of records.bindings ?? []) labels[binding.id] = binding.test?.description ?? "Verification check"
  return labels
}
