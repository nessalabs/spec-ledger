"use client"

import Link from "next/link"
import type { SessionProjection } from "@nessalabs/spec-ledger-client"
import { ReadableText } from "@/components/readable-text"

type Activity = NonNullable<SessionProjection["session"]>["activity"]

/** Progress notes already recorded by the agent, newest first. */
export function TaskUpdates({ activity }: { activity: Activity }) {
  return <section className="space-y-4">
    <div>
      <h2 className="font-semibold">Updates</h2>
      <p className="mt-1 text-sm text-muted-foreground">Progress notes and decisions recorded during this work.</p>
    </div>
    {!activity.length ? <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No updates yet. Progress notes will appear here when an agent records them.</p> :
      <ol className="space-y-4 border-l border-border pl-4 sm:pl-6">
        {activity.map(item => <li key={item.id} className="relative rounded-xl border border-border p-4 sm:p-5">
          <span aria-hidden className="absolute -left-[1.3rem] top-6 h-2 w-2 rounded-full bg-muted-foreground sm:-left-[1.8rem]" />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            {item.recordedAt ? <time dateTime={item.recordedAt}>{new Date(item.recordedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</time> : <span>Date not recorded</span>}
            <Link className="underline underline-offset-4" href={`/turns/${item.turnId}`}>View change</Link>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed"><ReadableText>{item.summary}</ReadableText></p>
          {(item.reason || item.discovery) && <details className="mt-3 text-sm text-muted-foreground">
            <summary className="cursor-pointer">Context</summary>
            {item.reason && <p className="mt-2 whitespace-pre-wrap"><ReadableText>{item.reason}</ReadableText></p>}
            {item.discovery && <p className="mt-2"><ReadableText>{item.discovery.observation}</ReadableText></p>}
          </details>}
        </li>)}
      </ol>}
  </section>
}
