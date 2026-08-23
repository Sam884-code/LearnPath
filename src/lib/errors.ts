// The closed set of error codes from SPEC.md §5.1. The client maps each code
// to an Armenian string, so codes must stay exactly as spelled here.
export type ErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STEP_LOCKED"
  | "STEP_NOT_ACTIVE"
  | "WRONG_STEP_TYPE"
  | "NO_ATTEMPTS_LEFT"
  | "NO_TEMPLATE_AVAILABLE"
  | "ALREADY_ENROLLED"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "VALIDATION_ERROR"
  // Post-MVP (SPEC.md §11.1): too many auth attempts.
  | "RATE_LIMITED";

export class ApiError extends Error {
  status: number;
  code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorBody(code: ErrorCode, message: string) {
  return { error: { code, message } };
}
