import { SENSITIVE_FIELDS, REDACTED } from '../redaction/sensitive-fields';

export interface NormalizeContextResult {
  context: Record<string, unknown>;
  truncated: boolean;
  redactedCount: number;
}

function isSerializable(v: unknown): boolean {
  if (v === undefined) return false;
  if (typeof v === 'number' && (Number.isNaN(v) || !Number.isFinite(v))) return false;
  if (typeof v === 'function') return false;
  if (typeof v === 'symbol') return false;
  if (typeof v === 'bigint') return false;
  return true;
}

function flattenAndProcess(
  obj: Record<string, unknown>,
  prefix: string,
  currentDepth: number,
  maxDepth: number,
  maxValueChars: number,
  result: Record<string, unknown>,
  stats: { truncated: boolean; redactedCount: number },
): void {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;

    if (!isSerializable(v)) continue;

    if (SENSITIVE_FIELDS.has(k.toLowerCase())) {
      result[key] = REDACTED;
      stats.redactedCount++;
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      if (currentDepth + 1 >= maxDepth) {
        // Depth limit reached: store as opaque value and mark truncated
        result[key] = '[truncated]';
        stats.truncated = true;
      } else {
        flattenAndProcess(
          v as Record<string, unknown>,
          key,
          currentDepth + 1,
          maxDepth,
          maxValueChars,
          result,
          stats,
        );
      }
    } else if (typeof v === 'string' && v.length > maxValueChars) {
      result[key] = v.slice(0, maxValueChars) + '…';
      stats.truncated = true;
    } else {
      result[key] = v;
    }
  }
}

export function normalizeContext(
  ctx: Record<string, unknown>,
  maxDepth: number,
  maxValueChars: number,
  maxFields: number,
): NormalizeContextResult {
  const stats = { truncated: false, redactedCount: 0 };
  const flat: Record<string, unknown> = {};

  flattenAndProcess(ctx, '', 0, maxDepth, maxValueChars, flat, stats);

  const keys = Object.keys(flat);
  if (keys.length > maxFields) {
    stats.truncated = true;
    const truncated: Record<string, unknown> = {};
    for (let i = 0; i < maxFields; i++) {
      const k = keys[i];
      if (k !== undefined) truncated[k] = flat[k];
    }
    return { context: truncated, truncated: true, redactedCount: stats.redactedCount };
  }

  return { context: flat, truncated: stats.truncated, redactedCount: stats.redactedCount };
}
