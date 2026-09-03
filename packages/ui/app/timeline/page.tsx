import { redirect } from "next/navigation"

/** Timeline folded into Turns (same history + automation). */
export default function TimelineRedirect() {
  redirect("/turns")
}
