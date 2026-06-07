export function normalizeTimestamp(raw?: string | number): number {
  if (raw === undefined || raw === null) {
    return Date.now() * 1000;
  }
  if (typeof raw === 'number') {
    return raw;
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    return Date.now() * 1000;
  }
  return ms * 1000;
}
