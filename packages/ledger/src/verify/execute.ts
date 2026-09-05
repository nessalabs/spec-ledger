import { runAllSavedChecks } from "./saved-check.js";
import type { VerifyReport } from "../types.js";
/** Explicit write-side operation. Reads must never call this. */
export function checkLedger(repoRoot: string, operationLockHeld = false): VerifyReport {
    return runAllSavedChecks(repoRoot, operationLockHeld);
}
