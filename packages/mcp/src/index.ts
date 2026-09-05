import { McpServer } from "@modelcontextprotocol/server"
import {
  executeOperation,
  normalizeOperationError,
  OPERATION_SCHEMAS,
  type OperationName,
} from "@nessalabs/spec-ledger"

const descriptions: Record<OperationName, string> = {
  plan_work: "Read the plan, permission, related context, and missing prerequisites without changing files.",
  get_context: "Read sealed context for one workstream slice without executing checks.",
  get_session: "Read current progress, evidence, reviews, and completion blockers.",
  preview_workflow: "Resolve a default or custom local workflow without preserving it.",
  get_workflow: "Read the selected workflow, attempts, current typed outputs, and blockers.",
  record_permission: "Record portable agent-reported permission without authenticating the supplied source.",
  begin_work: "Prepare authorized work and open one turn under the current revision.",
  record_progress: "Record revision- and source-bound acceptance progress.",
  record_decision: "Record a typed decision on an open workstream turn.",
  record_evidence: "Record current external evidence for a results-row binding.",
  record_review: "Record a current spec or code review through the shared review gates.",
  approve_alignment: "Record path-coverage approval for the current source.",
  run_checks: "Explicitly execute configured command checks and persist their report.",
  finish_turn: "Close or abandon an open turn through the shared gates.",
  complete_work: "Mark a workstream done only when every completion gate is satisfied.",
  set_workflow: "Preserve a default or custom resolved workflow snapshot for the current revision.",
  begin_workflow_step: "Begin a permitted attempt for the next eligible workflow step.",
  report_workflow_attempt: "Report an attempt complete or blocked without claiming output satisfaction.",
  record_workflow_output: "Link a typed current existing record to one workflow attempt.",
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
