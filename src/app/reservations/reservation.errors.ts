import { HttpErrorResponse } from '@angular/common/http';

export const GENERIC_ERROR = 'Something went wrong. Please try again.';
export const OFFLINE_ERROR = 'We could not reach the server. Check your connection and try again.';

// Field name to message, from the "errors" list of a 422 problem+json response
export type FieldErrors = Record<string, string>;

// One entry of the "errors" list the server sends with a 422: { field, message }
interface ProblemFieldError {
  field: string;
  message: string;
}

// The usable entries of errors[] in a problem+json body; empty when there are none
function problemErrors(err: unknown): ProblemFieldError[] {
  if (!(err instanceof HttpErrorResponse) || !err.error || typeof err.error !== 'object') {
    return [];
  }
  const list = (err.error as { errors?: unknown }).errors;
  if (!Array.isArray(list)) {
    return [];
  }
  const entries: ProblemFieldError[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const { field, message } = item as { field?: unknown; message?: unknown };
    if (typeof field === 'string' && field && typeof message === 'string' && message.trim()) {
      entries.push({ field, message: message.trim() });
    }
  }
  return entries;
}

// Reads errors[].field (with its message) from a problem+json body; empty when there are none
export function fieldErrors(err: unknown): FieldErrors {
  const result: FieldErrors = {};
  for (const { field, message } of problemErrors(err)) {
    // The first message for a field wins
    if (!(field in result)) {
      result[field] = message;
    }
  }
  return result;
}

// The text to show for a failed request: the problem+json "detail", else the first errors[] message
export function problemMessage(err: unknown, fallback: string = GENERIC_ERROR): string {
  if (err instanceof HttpErrorResponse) {
    const body: unknown = err.error;
    if (body && typeof body === 'object') {
      const detail = (body as { detail?: unknown }).detail;
      if (typeof detail === 'string' && detail.trim()) {
        return detail.trim();
      }
      const first = problemErrors(err)[0];
      if (first) {
        return first.message;
      }
    }
    // Status 0 means the request never got an answer
    if (err.status === 0) {
      return OFFLINE_ERROR;
    }
  }
  return fallback;
}
