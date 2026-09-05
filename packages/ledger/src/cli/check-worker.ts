import { executeSavedRun } from "../verify/saved-check.js";
const [root, runId, lock] = process.argv.slice(2);
if (!root || !runId)
    process.exit(2);
executeSavedRun(root, runId, lock === "operation-lock-held").catch(() => { process.exitCode = 1; });
