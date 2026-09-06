import { PageSkeleton } from "@/components/page-skeleton"

/**
 * Covers every route without its own loading file. Without it, clicking a
 * link leaves the previous page on screen until the server render lands.
 */
export default function Loading() {
  return <PageSkeleton />
}
