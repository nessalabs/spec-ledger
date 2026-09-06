import { McpServer } from "@modelcontextprotocol/server"
import {
  executeOperation,
  normalizeOperationError,
  OPERATION_SCHEMAS,
  type OperationName,
} from "@nessalabs/spec-ledger"

const descriptions: Record<OperationName, string> = {
  list_goals: "List optional iterative goals attached to existing work; normal task workflow is unchanged.",
  get_goal: "Inspect a goal, experiment attempts, reported results and measured progress without running checks.",
  create_goal: "Mark an open task as iterative improvement by attaching an optional goal and fixed metric; retains all existing plan and verification gates.",
  start_experiment: "Record a hypothesis and change for a new attempt under an active goal, within its experiment budget.",
  record_experiment_result: "Record an immutable experiment result, findings and retention decision; reported measurements never imply verify pass.",
  conclude_goal: "Conclude an iterative goal after all attempts have results; does not complete the workstream.",
  plan_work: "Read the plan, permission, related context, and missing prerequisites without changing files.",
  get_context: "Read sealed context for one workstream slice without executing checks.",
  get_session: "Read current progress, evidence, reviews, and completion blockers.",
  preview_workflow: "Resolve a default or custom local workflow without preserving it.",
  get_workflow_options: "Read editable workflow defaults, selection and available local skill paths without writing or running anything.",
  get_workflow: "Read the selected workflow, attempts, current typed outputs, and blockers.",
  get_execution: "Read execution association, bounded activity uncertainty, and unavailable recovery controls.",
  record_permission: "Record portable agent-reported permission without authenticating the supplied source.",
  begin_work: "Prepare authorized work and open one turn under the current revision.",
  record_progress: "Record revision- and source-bound acceptance progress.",
  record_decision: "Record a typed decision on an open workstream turn.",
  record_evidence: "Record current external evidence for a results-row binding.",
  record_review: "Record a current spec or code review through the shared review gates.",
  approve_alignment: "Record path-coverage approval for the current source.",
  run_saved_check: "Run one saved command check asynchronously with current source and check digests; retries return the same run.",
  get_check_run: "Read a saved check run and bounded actual output without executing work.",
  check_visual_evidence: "Check required screenshot coverage without executing work; missing current screenshots block closing and completion.",
  record_screenshot: "Attach a local PNG/JPEG screenshot for a declared UI surface on an open turn, with current source, revision and file integrity. Capture all relevant UI before finishing.",
  get_check_evidence: "Read a check definition, recorded test source, and current or historical evidence without executing work.",
  run_checks: "Execute configured command checks and report required screenshot coverage separately in visualEvidence; both must be ready before finishing visual work.",
  finish_turn: "Close or abandon an open turn through the shared gates.",
  complete_work: "Mark a workstream done only when every completion gate is satisfied.",
  set_workflow: "Preserve a default or custom resolved workflow snapshot for the current revision.",
  begin_workflow_step: "Begin a permitted attempt for the next eligible workflow step.",
  report_workflow_attempt: "Report an attempt complete or blocked without claiming output satisfaction.",
  record_workflow_output: "Link a typed current existing record to one workflow attempt.",
  register_execution: "Associate an existing open turn and current workflow attempt with an agent-reported host session.",
  configure_execution: "Record agent-reported continuation requests and timeout display policy without enabling host controls.",
  stop_execution: "Record an explicit stop for an execution association with portable provenance.",
  record_activity: "Submit one bounded best-effort activity signal without creating a durable operation receipt.",
}

/**
 * Advertise the exact shared application schema while letting the application
 * validator shape errors into the same operation envelope used by the CLI.
 */
function applicationValidatedSchema(schema: (typeof OPERATION_SCHEMAS)[OperationName]) {
  const standard = schema["~standard"]
  return {
    "~standard": {
      version: 1 as const,
      vendor: "spec-ledger-application",
      jsonSchema: standard.jsonSchema,
      validate: (value: unknown) => ({ value }),
    },
  }
}

export function createSpecLedgerMcpServer(root: string): McpServer {
  const server = new McpServer({ name: "spec-ledger", version: "0.1.0" })
  for (const operation of Object.keys(OPERATION_SCHEMAS) as OperationName[]) {
    server.registerTool(
      operation,
      { description: descriptions[operation], inputSchema: applicationValidatedSchema(OPERATION_SCHEMAS[operation]) },
      async (input: unknown) => {
        try {
          const result = executeOperation(root, operation, input)
          const envelope = { ok: true, operation, result }
          return {
            content: [{ type: "text" as const, text: JSON.stringify(envelope) }],
            structuredContent: envelope,
          }
        } catch (error) {
          const normalized = normalizeOperationError(error)
          const envelope = { ok: false, operation, error: normalized.toJSON() }
          return {
            content: [{ type: "text" as const, text: JSON.stringify(envelope) }],
            structuredContent: envelope,
            isError: true,
          }
        }
      },
    )
  }
  return server
}
