import type { ClientApiError } from "./api-client";

// The single place that turns an API error code into a user-facing message.
// The strings themselves live in messages/hy.json under `errors.*` (so all
// copy stays in one translated file); this just resolves a code to its key,
// falling back to a generic message for anything unmapped.
export function errorMessage(
  t: (key: string) => string,
  error: unknown
): string {
  const code = (error as ClientApiError | undefined)?.code;
  if (!code) return t("errors.default");

  // next-intl throws if a key is missing; probe by comparing the returned
  // value to the key path is unreliable, so we keep an explicit known set.
  const known = new Set([
    "INVALID_CREDENTIALS",
    "EMAIL_TAKEN",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "STEP_LOCKED",
    "STEP_NOT_ACTIVE",
    "WRONG_STEP_TYPE",
    "NO_ATTEMPTS_LEFT",
    "NO_TEMPLATE_AVAILABLE",
    "ALREADY_ENROLLED",
    "CLASSROOM_NOT_FOUND",
    "INVALID_INVITE",
    "FILE_TOO_LARGE",
    "UNSUPPORTED_FILE_TYPE",
    "VALIDATION_ERROR",
    "RATE_LIMITED",
    "NETWORK_ERROR",
    "INTERNAL_ERROR",
  ]);

  return known.has(code) ? t(`errors.${code}`) : t("errors.default");
}
