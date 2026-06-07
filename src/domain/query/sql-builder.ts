const VALID_LEVELS = new Set(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
const VALID_SORT = new Set(['asc', 'desc']);

export interface QueryBuildOptions {
  stream: string;
  from?: string;
  to?: string;
  level?: string;
  env?: string;
  q?: string;
  trace_id?: string;
  request_id?: string;
  limit: number;
  sort: 'asc' | 'desc';
  cursor_ts?: number;
}

export interface BuiltQuery {
  sql: string;
  start_time: number;
  end_time: number;
  size: number;
}

function escapeSqlString(s: string): string {
  return s
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return !(
        code <= 8 ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31) ||
        code === 127
      );
    })
    .join('')
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}

function parseTime(raw: string | undefined, fallbackMs: number): number {
  if (!raw) return fallbackMs * 1000;
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;
  const relMatch = /^now(?:-(\d+)([smhd]))?$/.exec(raw);
  if (relMatch) {
    const amount = relMatch[1] ? Number(relMatch[1]) : 0;
    const unit = relMatch[2] ?? 's';
    const msMap: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return (Date.now() - amount * (msMap[unit] ?? 0)) * 1000;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? fallbackMs * 1000 : parsed * 1000;
}

export function buildQuery(opts: QueryBuildOptions): BuiltQuery {
  const now = Date.now();
  const endTime = parseTime(opts.to, now);
  const startTime = parseTime(opts.from, now - 3_600_000);
  const sort = VALID_SORT.has(opts.sort) ? opts.sort : 'desc';

  const conditions: string[] = [`_timestamp >= ${startTime}`, `_timestamp <= ${endTime}`];

  if (opts.cursor_ts !== undefined) {
    conditions.push(
      sort === 'desc' ? `_timestamp < ${opts.cursor_ts}` : `_timestamp > ${opts.cursor_ts}`,
    );
  }

  if (opts.level) {
    const levels = opts.level
      .split(',')
      .map((l) => l.trim().toLowerCase())
      .filter((l) => VALID_LEVELS.has(l));
    if (levels.length > 0) {
      conditions.push(`level IN (${levels.map((l) => `'${l}'`).join(', ')})`);
    }
  }

  if (opts.env) {
    conditions.push(`env = '${escapeSqlString(opts.env)}'`);
  }

  if (opts.q) {
    const escaped = escapeSqlString(opts.q);
    conditions.push(`match_all_indexed_ignore_case('${escaped}')`);
  }

  if (opts.trace_id) {
    conditions.push(`trace_id = '${escapeSqlString(opts.trace_id)}'`);
  }

  if (opts.request_id) {
    conditions.push(`request_id = '${escapeSqlString(opts.request_id)}'`);
  }

  const where = conditions.join(' AND ');
  const orderDir = sort.toUpperCase();
  const sql = `SELECT * FROM ${opts.stream} WHERE ${where} ORDER BY _timestamp ${orderDir}`;

  return { sql, start_time: startTime, end_time: endTime, size: opts.limit };
}
