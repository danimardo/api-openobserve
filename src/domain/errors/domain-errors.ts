export const ERROR_CODES = {
  VALIDATION_ERROR: 'validation_error',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  PAYLOAD_TOO_LARGE: 'payload_too_large',
  UNSUPPORTED_MEDIA_TYPE: 'unsupported_media_type',
  RATE_LIMITED: 'rate_limited',
  OPENOBSERVE_ERROR: 'openobserve_error',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  validation_error: 400,
  unauthorized: 401,
  forbidden: 403,
  payload_too_large: 413,
  unsupported_media_type: 415,
  rate_limited: 429,
  openobserve_error: 502,
};

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}
