import { z } from 'zod';

const CursorSchema = z.object({
  ts: z.number(),
  sort: z.enum(['asc', 'desc']),
});

export type CursorData = z.infer<typeof CursorSchema>;

export function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

export function decodeCursor(raw: string): CursorData | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json) as unknown;
    const result = CursorSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
