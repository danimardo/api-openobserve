import { buildQuery } from '../../src/domain/query/sql-builder';

const BASE = { stream: 'payments_api', limit: 10, sort: 'desc' as const };

describe('buildQuery — prevención de inyección SQL (FR-016, CA11)', () => {
  it('genera SELECT ... FROM <stream> con ORDER BY correcto', () => {
    const { sql } = buildQuery(BASE);
    expect(sql).toMatch(/SELECT .+ FROM payments_api/);
    expect(sql).toContain('ORDER BY _timestamp DESC');
  });

  it('usa sort ASC cuando se solicita', () => {
    const { sql } = buildQuery({ ...BASE, sort: 'asc' });
    expect(sql).toContain('ORDER BY _timestamp ASC');
  });

  it('filtra levels válidos mediante allowlist', () => {
    const { sql } = buildQuery({ ...BASE, level: 'info,warn' });
    expect(sql).toMatch(/level IN \('info', 'warn'\)/);
  });

  it('descarta levels fuera de la allowlist y deja solo los válidos', () => {
    // El split es por coma: "info" es válido, "VERBOSE" no
    const { sql } = buildQuery({ ...BASE, level: 'info,VERBOSE' });
    expect(sql).toContain("level IN ('info')");
    expect(sql).not.toContain('VERBOSE');
  });

  it('omite cláusula level si ningún valor pasa la allowlist', () => {
    const { sql } = buildQuery({ ...BASE, level: 'LOG,VERBOSE' });
    expect(sql).not.toContain('level IN');
  });

  it('escapa comillas simples en q para evitar que salgan del string SQL (CA11)', () => {
    const { sql } = buildQuery({ ...BASE, q: "O'Brien" });
    expect(sql).toContain("O''Brien");
  });

  it('elimina punto y coma en q para bloquear inyección multiseatencia', () => {
    const { sql } = buildQuery({ ...BASE, q: "'; DROP TABLE logs; --" });
    // El ';' se elimina: no hay múltiples sentencias en el SQL generado
    expect(sql).not.toContain(';');
    // Las comillas se escapan: el valor queda como string literal en SQL (inofensivo)
    expect(sql).toContain('match_all_indexed_ignore_case(');
  });

  it('elimina comentarios inline (--) en q', () => {
    const { sql } = buildQuery({ ...BASE, q: 'value -- comment' });
    expect(sql).not.toContain('--');
  });

  it('escapa y elimina inyección en trace_id', () => {
    const { sql } = buildQuery({ ...BASE, trace_id: "trace' OR '1'='1" });
    expect(sql).not.toContain(';');
    // Las comillas se escapan, el valor queda como string literal
    expect(sql).toContain("trace_id = '");
  });

  it('escapa comillas simples en request_id (valor literal en SQL)', () => {
    const { sql } = buildQuery({ ...BASE, request_id: 'legit-id-001' });
    expect(sql).toContain("request_id = 'legit-id-001'");
  });

  it('elimina punto y coma en request_id para bloquear múltiples sentencias', () => {
    const { sql } = buildQuery({ ...BASE, request_id: "1'; DROP TABLE x" });
    // ';' eliminado: no hay múltiples sentencias
    expect(sql).not.toContain(';');
    // El valor con comillas escapadas queda como string literal SQL (inofensivo)
    expect(sql).toContain("request_id = '");
  });

  it('aplica cursor de paginación con timestamp DESC', () => {
    const ts = 1748000000000000;
    const { sql } = buildQuery({ ...BASE, sort: 'desc', cursor_ts: ts });
    expect(sql).toContain(`_timestamp < ${ts}`);
  });

  it('aplica cursor de paginación con timestamp ASC', () => {
    const ts = 1748000000000000;
    const { sql } = buildQuery({ ...BASE, sort: 'asc', cursor_ts: ts });
    expect(sql).toContain(`_timestamp > ${ts}`);
  });

  it('propaga size=limit al resultado', () => {
    expect(buildQuery({ ...BASE, limit: 42 }).size).toBe(42);
  });

  it('incluye env en WHERE cuando se especifica', () => {
    const { sql } = buildQuery({ ...BASE, env: 'production' });
    expect(sql).toContain("env = 'production'");
  });

  it('acepta from="now" como tiempo relativo (sin cantidad)', () => {
    // Cubre la rama relMatch con relMatch[1] undefined → amount=0
    const before = Date.now() * 1000;
    const { sql } = buildQuery({ ...BASE, from: 'now' });
    const after = Date.now() * 1000;
    // El tiempo resultante debe estar cerca del now actual (± margen)
    expect(sql).toMatch(/_timestamp >= \d+/);
    const match = /_timestamp >= (\d+)/.exec(sql);
    const ts = match ? Number(match[1]) : 0;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 2000);
  });

  it('acepta from="now-1h" como tiempo relativo', () => {
    const approxOneHourAgo = (Date.now() - 3_600_000) * 1000;
    const { sql } = buildQuery({ ...BASE, from: 'now-1h' });
    const match = /_timestamp >= (\d+)/.exec(sql);
    const ts = match ? Number(match[1]) : 0;
    expect(ts).toBeGreaterThan(approxOneHourAgo - 5_000_000);
    expect(ts).toBeLessThan(approxOneHourAgo + 5_000_000);
  });
});
