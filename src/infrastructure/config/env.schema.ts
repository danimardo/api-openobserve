import { z } from 'zod';

const commaSeparated = z.string().transform((s) =>
  s
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean),
);

export const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  O2_URL: z.string().url('O2_URL must be a valid URL'),
  O2_ORG: z.string().min(1),
  O2_AUTH_USER: z.string().min(1),
  O2_AUTH_PASSWORD: z.string().min(1),

  API_KEYS_JSON: z.string().optional(),
  API_KEYS_FILE: z.string().optional(),

  ALLOWED_ENVS: commaSeparated.default(['development', 'staging', 'production', 'test']),

  INGEST_MAX_BATCH: z.coerce.number().int().positive().default(500),
  INGEST_MAX_BODY_MB: z.coerce.number().positive().default(5),
  LOG_MESSAGE_MAX_CHARS: z.coerce.number().int().positive().default(4096),
  CONTEXT_MAX_DEPTH: z.coerce.number().int().positive().default(5),
  CONTEXT_VALUE_MAX_CHARS: z.coerce.number().int().positive().default(2048),
  MAX_FIELDS_PER_RECORD: z.coerce.number().int().positive().default(200),

  QUEUE_MAX_ITEMS: z.coerce.number().int().positive().default(10000),
  RETRY_ATTEMPTS: z.coerce.number().int().nonnegative().default(3),
  RETRY_BACKOFF_MS: z.coerce.number().int().positive().default(200),
  DELIVERY_BATCH_MAX: z.coerce.number().int().positive().default(500),
  DELIVERY_FLUSH_MS: z.coerce.number().int().positive().default(1000),

  RATE_LIMIT_RPS: z.coerce.number().int().positive().default(100),

  OO_FORWARDER_URL: z.string().url().optional(),
  OO_FORWARDER_KEY: z.string().min(1).optional(),
  OO_FORWARDER_SERVICE: z.string().min(1).optional(),

  CORS_ALLOWED_ORIGINS: commaSeparated.default([]),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),

  METRICS_ENABLED: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(true),
});

export type AppEnv = z.infer<typeof EnvSchema>;
