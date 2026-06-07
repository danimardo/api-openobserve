import { encodeCursor, decodeCursor } from '../../src/domain/query/cursor';

describe('cursor opaco (FR-017)', () => {
  it('codifica a string opaco sin JSON visible', () => {
    const enc = encodeCursor({ ts: 1748000000000000, sort: 'desc' });
    expect(typeof enc).toBe('string');
    expect(enc).not.toContain('{');
    expect(enc).not.toContain(':');
  });

  it('roundtrip estable: encode → decode devuelve los mismos datos', () => {
    const data = { ts: 1748000000000000, sort: 'desc' as const };
    expect(decodeCursor(encodeCursor(data))).toEqual(data);
  });

  it('roundtrip estable para sort asc', () => {
    const data = { ts: 0, sort: 'asc' as const };
    expect(decodeCursor(encodeCursor(data))).toEqual(data);
  });

  it('es determinista: el mismo input produce el mismo cursor', () => {
    const data = { ts: 123456789, sort: 'asc' as const };
    expect(encodeCursor(data)).toBe(encodeCursor(data));
  });

  it('devuelve null para cursor vacío', () => {
    expect(decodeCursor('')).toBeNull();
  });

  it('devuelve null para cursor con base64 inválido', () => {
    expect(decodeCursor('!!!invalid!!!')).toBeNull();
  });

  it('devuelve null para cursor con JSON malformado', () => {
    const bad = Buffer.from('not-json').toString('base64url');
    expect(decodeCursor(bad)).toBeNull();
  });

  it('devuelve null si falta campo ts', () => {
    const bad = Buffer.from(JSON.stringify({ sort: 'desc' })).toString('base64url');
    expect(decodeCursor(bad)).toBeNull();
  });
});
