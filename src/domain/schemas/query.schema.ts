import { z } from 'zod';

export const QueryParamsSchema = z.object({
  service: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  level: z.string().optional(),
  env: z.string().optional(),
  q: z.string().optional(),
  trace_id: z.string().optional(),
  request_id: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional().default(100),
  cursor: z.string().optional(),
  sort: z.enum(['asc', 'desc']).optional().default('desc'),
  include_total: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .optional()
    .default(false),
});

export type QueryParams = z.infer<typeof QueryParamsSchema>;

export const QueryResponseSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
  next_cursor: z.string().nullable(),
  range_truncated: z.boolean().optional(),
  limit_truncated: z.boolean().optional(),
  request_id: z.string(),
  total: z.number().int().optional(),
});

export type QueryResponse = z.infer<typeof QueryResponseSchema>;
