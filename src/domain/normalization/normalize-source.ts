export function normalizeSource(raw?: string): 'backend' | 'frontend' | 'unknown' {
  if (raw === 'backend') return 'backend';
  if (raw === 'frontend') return 'frontend';
  return 'unknown';
}
