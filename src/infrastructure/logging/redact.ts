const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'auth',
  'api_key',
  'apikey',
  'private_key',
  'privatekey',
  'access_token',
  'refresh_token',
  'cookie',
  'cookies',
  'session',
  'secret_hash',
]);

const REDACTED = '***redacted***';

export function redactLogData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      result[k] = REDACTED;
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = redactLogData(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}
