export type ActivityKind = "session-start" | "session-stop" | "tool-start" | "tool-finish" | "tool-failure" | "waiting-user" | "resumed"
export interface ActivityEvent {
  eventId: string; sessionId: string; sequence: number; kind: ActivityKind; observedAt: string
  invocationId?: string; toolName?: string; reason?: string
}
export interface ExecutionAssociation {
  schemaVersion: 1; registrationId: string; workstreamId: string; turnId: string; workflowAttemptId: string | null
  hostSessionRef: string; revisionDigest: string; sourceDigest: string; registeredAt: string; provenance: "agent-reported"
}
export interface ExecutionPolicy {
  schemaVersion: 1; registrationId: string; revision: number; recordedAt: string
  continuation: { requested: boolean; minIntervalMs: number; retryLimit: number; expiresAt: string | null }
  timeout: { warningAfterMs: number | null; enforceAfterMs: number | null }
  source: { kind: "agent-reported"; reference: string }; userOptInVerified: false
}
export interface ExecutionStop { schemaVersion: 1; registrationId: string; reason: string; stoppedAt: string; source: { kind: "agent-reported"; reference: string } }
export type ExecutionBlockReason = "no-registration" | "not-requested" | "user-opt-in-unverified" | "host-resume-unsupported" | "host-liveness-unsupported" | "permission-revoked" | "verified-complete" | "explicitly-stopped" | "expired" | "retry-exhausted" | "waiting-for-user" | "inflight-invocation" | "activity-uncertain" | "remaining-work"
export interface ExecutionActivityProjection {
  association: ExecutionAssociation | null
  state: "unregistered" | "active" | "waiting-user" | "stopped" | "uncertain" | "complete"
  signals: { retained:number; totalSeen:number; dropped:number; duplicateCount:number; outOfOrderCount:number; gaps:Array<{from:number;to:number}>; lastObservedAt:string|null; recentEvents:ActivityEvent[] }
  inflightInvocations: Array<{invocationId:string;toolName?:string;startedAt:string;lastSequence:number;status:"inflight"|"finish-missing"}>
  waiting: {active:boolean;reason?:string;since?:string}
  continuation: {requested:boolean;effective:false;userOptInVerified:false;minIntervalMs:number;retryLimit:number;expiresAt:string|null;attempts:[];remainingRetries:number;readiness:"not-requested"|"blocked"|"unavailable"|"complete";reasons:ExecutionBlockReason[];guidance:string[];prompt:string|null}
  timeout: {warningAfterMs:number|null;enforceAfterMs:number|null;warnings:Array<{invocationId:string;elapsedMs:number;thresholdMs:number}>;enforcement:"off"|"unsupported";reasons:string[]}
  hostCapabilities: {verified:false;liveness:false;resume:false;cancelTool:false;ownedProcess:false}
  stop: {stopped:boolean;reason?:string;stoppedAt?:string}
}
