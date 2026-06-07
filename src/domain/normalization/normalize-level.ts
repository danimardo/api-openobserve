const LEVEL_MAP: Record<string, string> = {
  trace: 'trace',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  warning: 'warn',
  error: 'error',
  err: 'error',
  fatal: 'fatal',
  critical: 'fatal',
};

export function normalizeLevel(raw: string): string {
  return LEVEL_MAP[raw.toLowerCase()] ?? 'invalid_level';
}
