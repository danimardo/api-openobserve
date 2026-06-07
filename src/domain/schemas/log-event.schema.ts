import { z } from 'zod';

export const VALID_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof VALID_LEVELS)[number];

export const LogEventInputSchema = z
  .object({
    _timestamp: z.union([z.string(), z.number()]).optional(),
    service: z.string().regex(/^[a-z0-9_]{3,64}$/, 'Invalid service name'),
    env: z.string().min(1),
    level: z.string().min(1),
    message: z.string().min(1),
    version: z.string().optional(),
    event_id: z.string().optional(),
    trace_id: z.string().optional(),
    span_id: z.string().optional(),
    request_id: z.string().optional(),
    hostname: z.string().optional(),
    source: z.string().optional(),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type LogEventInput = z.infer<typeof LogEventInputSchema>;

export const NormalizedLogEventSchema = z.object({
  _timestamp: z.number(),
  service: z.string(),
  env: z.string(),
  level: z.string(),
  message: z.string(),
  version: z.string().optional(),
  event_id: z.string().optional(),
  trace_id: z.string().optional(),
  span_id: z.string().optional(),
  request_id: z.string().optional(),
  hostname: z.string().optional(),
  source: z.enum(['backend', 'frontend', 'unknown']),
  context: z.record(z.string(), z.unknown()).optional(),
  context_truncated: z.boolean().optional(),
});

export type NormalizedLogEvent = z.infer<typeof NormalizedLogEventSchema>;
