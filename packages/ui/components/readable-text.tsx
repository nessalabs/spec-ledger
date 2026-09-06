"use client"

import { createContext, useContext, type ReactNode } from "react"
import { readableText, type RecordLabels } from "@/lib/record-labels"

const Labels = createContext<RecordLabels>({})
export function RecordLabelsProvider({ labels, children }: { labels: RecordLabels; children: ReactNode }) {
  return <Labels.Provider value={labels}>{children}</Labels.Provider>
}
export function useRecordLabels() { return useContext(Labels) }
export function ReadableText({ children, fallback }: { children: string | null | undefined; fallback?: string }) {
  return <>{readableText(children, useRecordLabels(), fallback)}</>
}
