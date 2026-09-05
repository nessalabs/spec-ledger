export type OperationErrorCode =
  | "invalid_input"
  | "not_found"
  | "permission_denied"
  | "prerequisite_missing"
  | "revision_conflict"
  | "source_conflict"
  | "idempotency_conflict"
  | "execution_unknown"
  | "operation_busy"
  | "operation_failed"

export interface OperationErrorShape {
  code: OperationErrorCode
  message: string
  retryable: boolean
  details?: unknown
}

export class OperationError extends Error {
  readonly code: OperationErrorCode
  readonly retryable: boolean
  readonly details?: unknown

  constructor(shape: OperationErrorShape) {
    super(shape.message)
    this.name = "OperationError"
    this.code = shape.code
    this.retryable = shape.retryable
    this.details = shape.details
  }

  toJSON(): OperationErrorShape {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.details === undefined ? {} : { details: this.details }),
    }
  }
}

export function operationError(
  code: OperationErrorCode,
  message: string,
  retryable = false,
  details?: unknown,
): OperationError {
  return new OperationError({ code, message, retryable, details })
}

export function normalizeOperationError(error: unknown): OperationError {
  if (error instanceof OperationError) return error
  const message = error instanceof Error ? error.message : String(error)
  if (/not found|no turn|no graph/i.test(message)) return operationError("not_found", message)
  if (/permission|authorized|approval|denial|revok/i.test(message)) {
    return operationError("permission_denied", message)
  }
  if (/(review id|workflow record id) already exists/i.test(message)) {
    return operationError("idempotency_conflict", message)
  }
  if (/required|requires|must |refused|blocking|missing|shape at least/i.test(message)) {
    return operationError("prerequisite_missing", message)
  }
  if (/invalid|usage|unknown|must contain|must stay|escapes|does not match/i.test(message)) {
    return operationError("invalid_input", message)
  }
  return operationError("operation_failed", message)
}
