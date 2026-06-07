import { normalizeTimestamp } from '../../src/domain/normalization/normalize-timestamp';
import { normalizeSource } from '../../src/domain/normalization/normalize-source';

describe('normalizeTimestamp (FR-006)', () => {
  const NOW_MS = 1748000000000;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  });
  afterEach(() => jest.restoreAllMocks());

  it('uses reception time (µs) when field is missing', () => {
    const result = normalizeTimestamp(undefined);
    expect(result).toBe(NOW_MS * 1000);
  });

  it('converts ISO-8601 string to microseconds', () => {
    const iso = '2025-01-15T10:30:00.000Z';
    const expectedMs = Date.parse(iso);
    expect(normalizeTimestamp(iso)).toBe(expectedMs * 1000);
  });

  it('keeps a numeric value as microseconds', () => {
    const µs = 1748000000000000;
    expect(normalizeTimestamp(µs)).toBe(µs);
  });

  it('falls back to reception time for an invalid ISO string', () => {
    expect(normalizeTimestamp('not-a-date')).toBe(NOW_MS * 1000);
  });

  it('handles numeric zero as a valid timestamp', () => {
    expect(normalizeTimestamp(0)).toBe(0);
  });
});

describe('normalizeSource', () => {
  it('devuelve "backend" cuando el valor es "backend"', () => {
    expect(normalizeSource('backend')).toBe('backend');
  });

  it('devuelve "frontend" cuando el valor es "frontend"', () => {
    expect(normalizeSource('frontend')).toBe('frontend');
  });

  it('devuelve "unknown" para cualquier otro valor', () => {
    expect(normalizeSource('mobile')).toBe('unknown');
    expect(normalizeSource(undefined)).toBe('unknown');
    expect(normalizeSource('')).toBe('unknown');
  });
});
