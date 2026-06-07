import * as fs from 'fs';
import { ApiKey, ApiKeysArraySchema } from '../../domain/schemas/api-key.schema';
import { type AppEnv } from './env.schema';

const RESERVED_STREAMS = new Set(['log_gateway']);

function validateProductionConstraints(keys: ApiKey[], nodeEnv: string): void {
  for (const key of keys) {
    if (nodeEnv === 'production' && key.services.includes('*')) {
      throw new Error(
        `[API_KEYS] Key "${key.id}": services:["*"] is not allowed in production (FR-023)`,
      );
    }

    if (key.client_type === 'frontend') {
      const forbidden = key.services.filter((s) => RESERVED_STREAMS.has(s));
      if (forbidden.length > 0) {
        throw new Error(
          `[API_KEYS] Frontend key "${key.id}" cannot authorize reserved streams: ${forbidden.join(', ')} (FR-024)`,
        );
      }
    }
  }
}

export function loadApiKeys(
  env: Pick<AppEnv, 'API_KEYS_JSON' | 'API_KEYS_FILE' | 'NODE_ENV'>,
): Map<string, ApiKey> {
  let raw: unknown;

  if (env.API_KEYS_JSON) {
    try {
      raw = JSON.parse(env.API_KEYS_JSON);
    } catch {
      throw new Error('[API_KEYS] API_KEYS_JSON is not valid JSON');
    }
  } else if (env.API_KEYS_FILE) {
    let content: string;
    try {
      content = fs.readFileSync(env.API_KEYS_FILE, 'utf-8');
    } catch {
      throw new Error(`[API_KEYS] Cannot read API_KEYS_FILE: ${env.API_KEYS_FILE}`);
    }
    try {
      raw = JSON.parse(content);
    } catch {
      throw new Error('[API_KEYS] API_KEYS_FILE does not contain valid JSON');
    }
  } else {
    throw new Error('[API_KEYS] Neither API_KEYS_JSON nor API_KEYS_FILE is set');
  }

  const result = ApiKeysArraySchema.safeParse(raw);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`[API_KEYS] Invalid API key configuration:\n${formatted}`);
  }

  const keys = result.data;
  validateProductionConstraints(keys, env.NODE_ENV);

  const map = new Map<string, ApiKey>();
  for (const key of keys) {
    if (map.has(key.id)) {
      throw new Error(`[API_KEYS] Duplicate key id: "${key.id}"`);
    }
    map.set(key.id, key);
  }

  return map;
}
