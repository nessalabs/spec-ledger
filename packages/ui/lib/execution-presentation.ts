export type ExecutionDisplayState =
  | "unregistered"
  | "active"
  | "waiting-user"
  | "stopped"
  | "uncertain"
  | "complete"

const STATE_LABELS: Record<ExecutionDisplayState, string> = {
  unregistered: "No session registered",
  active: "Active",
  "waiting-user": "Waiting for user",
  stopped: "Stopped",
  uncertain: "Activity uncertain",
  complete: "Execution complete",
}

export function executionStateLabel(state: ExecutionDisplayState) {
  return STATE_LABELS[state]
}

const REASON_LABELS = {
  "no-registration": "No host session is registered.",
  "not-requested": "Continuation was not requested.",
  "user-opt-in-unverified": "User opt-in has not been verified.",
  "host-resume-unsupported": "This host cannot resume the session.",
  "host-liveness-unsupported": "This host cannot confirm session liveness.",
  "permission-revoked": "Permission no longer allows continuation.",
  "verified-complete": "Verified completion prevents another continuation.",
  "explicitly-stopped": "The user explicitly stopped this execution.",
  expired: "The continuation policy expired.",
  "retry-exhausted": "The continuation retry limit was reached.",
  "waiting-for-user": "The session is waiting for the user.",
  "inflight-invocation": "A tool invocation may still be running.",
  "activity-uncertain": "Activity signals are incomplete or uncertain.",
  "remaining-work": "Required work remains.",
} as const

export function executionReasonLabel(reason: keyof typeof REASON_LABELS) {
  return REASON_LABELS[reason]
}

export function durationLabel(milliseconds: number) {
  if (milliseconds < 60_000) return `${Math.round(milliseconds / 1000)}s`
  if (milliseconds < 3_600_000) return `${Math.round(milliseconds / 60_000)}m`
  return `${Math.round(milliseconds / 3_600_000)}h`
}
