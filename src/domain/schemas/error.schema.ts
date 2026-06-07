import { z } from 'zod';

export const ErrorDetailSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export const ErrorResponseSchema = z.object({
  error: ErrorDetailSchema,
  request_id: z.string(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const IngestErrorItemSchema = z.object({
  index: z.number().int(),
  code: z.string(),
  message: z.string(),
});

export const IngestResponseSchema = z.object({
  accepted: z.number().int(),
  rejected: z.number().int(),
  errors: z.array(IngestErrorItemSchema).optional(),
});

export type IngestResponse = z.infer<typeof IngestResponseSchema>;
