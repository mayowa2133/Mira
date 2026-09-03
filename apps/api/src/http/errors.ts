/**
 * The error contract.
 *
 * Implements `docs/05-api/error-contract.md`. Every non-2xx response has this
 * shape, and the message is user-presentable copy — never a stack trace, a
 * provider error, or a SQL error.
 */

/** Stable, machine-readable codes. Never change what one means. */
export const ErrorCode = {
  // Auth
  unauthenticated: 'unauthenticated',
  tokenExpired: 'token_expired',
  tokenInvalid: 'token_invalid',
  accountDeleted: 'account_deleted',
  providerRejected: 'provider_rejected',

  // Resources
  garmentNotFound: 'garment_not_found',
  outfitNotFound: 'outfit_not_found',
  candidateNotFound: 'candidate_not_found',
  tryOnNotFound: 'try_on_not_found',
  bodyProfileNotFound: 'body_profile_not_found',
  importNotFound: 'import_not_found',
  jobNotFound: 'job_not_found',

  // Validation
  validationFailed: 'validation_failed',
  notInTaxonomy: 'not_in_taxonomy',
  subcategoryMismatch: 'subcategory_mismatch',
  immutableField: 'immutable_field',
  invalidStatusTransition: 'invalid_status_transition',
  missingIdempotencyKey: 'missing_idempotency_key',

  // Conflict
  versionConflict: 'version_conflict',
  idempotencyKeyReused: 'idempotency_key_reused',
  duplicateUnresolved: 'duplicate_unresolved',

  // Ingestion
  uploadKeyInvalid: 'upload_key_invalid',
  unsupportedImageFormat: 'unsupported_image_format',
  imageTooLarge: 'image_too_large',
  noGarmentDetected: 'no_garment_detected',
  tagUnreadable: 'tag_unreadable',
  receiptUnreadable: 'receipt_unreadable',
  noItemsExtracted: 'no_items_extracted',

  // AI
  aiUnavailable: 'ai_unavailable',
  aiTimeout: 'ai_timeout',
  aiInvalidOutput: 'ai_invalid_output',
  tryOnGenerationFailed: 'try_on_generation_failed',

  // Limits
  rateLimited: 'rate_limited',
  tryOnBudgetExceeded: 'try_on_budget_exceeded',

  // Generic
  internal: 'internal',
  serviceUnavailable: 'service_unavailable',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * User-presentable copy.
 *
 * Never blames the user or the model, and always implies the next action
 * (`docs/05-api/error-contract.md` — Messages).
 */
const MESSAGES: Partial<Record<ErrorCodeValue, string>> = {
  [ErrorCode.unauthenticated]: 'Please sign in again.',
  [ErrorCode.tokenExpired]: 'Please sign in again.',
  [ErrorCode.tokenInvalid]: 'Please sign in again.',
  [ErrorCode.garmentNotFound]: "This piece isn't in your closet any more.",
  [ErrorCode.outfitNotFound]: "This look isn't saved any more.",
  [ErrorCode.candidateNotFound]: "We can't find that purchase any more.",
  [ErrorCode.tryOnNotFound]: "That try-on isn't available any more.",
  [ErrorCode.bodyProfileNotFound]: 'Add a few photos so Mira can show your wardrobe on you.',
  [ErrorCode.noGarmentDetected]:
    "We couldn't find a garment in that photo. Try one item at a time?",
  [ErrorCode.tagUnreadable]: 'That tag was hard to read — try again with it flat and well lit?',
  [ErrorCode.receiptUnreadable]: "We couldn't read that receipt. A flatter photo usually helps.",
  [ErrorCode.noItemsExtracted]: "We couldn't find any items on that receipt.",
  [ErrorCode.aiUnavailable]: "Mira can't style you right now. Everything else still works.",
  [ErrorCode.aiTimeout]: "That's taking longer than usual.",
  [ErrorCode.tryOnGenerationFailed]: "That try-on didn't come out right. Want to try again?",
  [ErrorCode.rateLimited]: "Mira's a bit busy. Try again in a moment.",
  [ErrorCode.duplicateUnresolved]: 'You may already own this — tell us which it is.',
  [ErrorCode.versionConflict]: "This piece changed somewhere else. We've refreshed it.",
  [ErrorCode.validationFailed]: "Something in that request wasn't right.",
  [ErrorCode.immutableField]: "That detail can't be changed.",
  [ErrorCode.internal]: 'Something went wrong on our side.',
  [ErrorCode.serviceUnavailable]: "Mira is briefly unavailable. We're on it.",
};

export type ErrorDetail = { field: string; issue: string };

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCodeValue;
  readonly details: ErrorDetail[] | undefined;
  readonly retryAfter: number | undefined;

  constructor(
    statusCode: number,
    code: ErrorCodeValue,
    options: {
      message?: string;
      details?: ErrorDetail[];
      retryAfter?: number;
      cause?: unknown;
    } = {},
  ) {
    super(options.message ?? MESSAGES[code] ?? 'Something went wrong.');
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details;
    this.retryAfter = options.retryAfter;
    if (options.cause !== undefined) this.cause = options.cause;
  }

  toBody(requestId: string): {
    error: {
      code: string;
      message: string;
      details?: ErrorDetail[];
      request_id: string;
      retry_after: number | null;
    };
  } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
        request_id: requestId,
        retry_after: this.retryAfter ?? null,
      },
    };
  }
}

export const unauthenticated = () => new ApiError(401, ErrorCode.unauthenticated);

/**
 * Not found.
 *
 * THE 404 RULE: a resource that exists but belongs to another user returns 404,
 * never 403 — a 403 would confirm the resource exists
 * (`docs/05-api/error-contract.md`, SEC-5).
 */
export const notFound = (code: ErrorCodeValue) => new ApiError(404, code);

export const validationFailed = (details: ErrorDetail[]) =>
  new ApiError(422, ErrorCode.validationFailed, { details });

export const conflict = (code: ErrorCodeValue) => new ApiError(409, code);

export const rateLimited = (retryAfter: number) =>
  new ApiError(429, ErrorCode.rateLimited, { retryAfter });

export const internal = (cause?: unknown) =>
  new ApiError(500, ErrorCode.internal, cause === undefined ? {} : { cause });
