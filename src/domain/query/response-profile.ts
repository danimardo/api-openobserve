import { SENSITIVE_FIELDS } from '../redaction/sensitive-fields';

// FR-018: campos permitidos en respuesta frontend_reduced
const FRONTEND_ALLOWED_FIELDS = new Set([
  '_timestamp',
  'level',
  'message',
  'service',
  'env',
  'request_id',
  'trace_id',
]);

export function applyFrontendReducedProfile(
  item: Record<string, unknown>,
): Record<string, unknown> {
  const reduced: Record<string, unknown> = {};

  for (const field of FRONTEND_ALLOWED_FIELDS) {
    if (field in item) reduced[field] = item[field];
  }

  // Incluir context pero eliminar campos sensibles/conocidos
  if (item['context'] !== null && typeof item['context'] === 'object') {
    const ctx = item['context'] as Record<string, unknown>;
    const filteredCtx: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ctx)) {
      if (!SENSITIVE_FIELDS.has(k.toLowerCase())) {
        filteredCtx[k] = v;
      }
    }
    if (Object.keys(filteredCtx).length > 0) {
      reduced['context'] = filteredCtx;
    }
  }

  return reduced;
}
