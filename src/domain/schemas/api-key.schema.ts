import { z } from 'zod';

export const ScopeSchema = z.enum(['read', 'write']);
export type Scope = z.infer<typeof ScopeSchema>;

export const ClientTypeSchema = z.enum(['backend', 'frontend']);
export type ClientType = z.infer<typeof ClientTypeSchema>;

export const ReadPolicySchema = z.object({
  response_profile: z.enum(['full', 'frontend_reduced']).default('frontend_reduced'),
  allow_q: z.boolean().default(false),
  max_query_window: z.string().default('7d'),
  max_limit: z.number().int().positive().default(500),
});

export type ReadPolicy = z.infer<typeof ReadPolicySchema>;

export const ApiKeySchema = z.object({
  id: z.string().min(1),
  secret_hash: z.string().regex(/^[0-9a-f]{64}$/, 'secret_hash must be a SHA-256 hex string'),
  services: z.array(z.string().min(1)).min(1),
  scopes: z.array(ScopeSchema).min(1),
  client_type: ClientTypeSchema,
  allowed_origins: z.array(z.string()).optional().default([]),
  envs: z.array(z.string()).optional(),
  read_policy: ReadPolicySchema.optional(),
});

export type ApiKey = z.infer<typeof ApiKeySchema>;

export const ApiKeysArraySchema = z.array(ApiKeySchema);
