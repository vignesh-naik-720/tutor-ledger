import type { ZodTypeAny, z } from 'zod';

// Request validation helper (T028). Returns the parsed value or a list of field paths and rule
// codes. Submitted values are never returned (contracts/api.md, Error model).

export interface FieldIssue {
  path: string;
  rule: string;
}

export type ParseResult<S extends ZodTypeAny> =
  | { ok: true; data: z.infer<S> }
  | { ok: false; fields: FieldIssue[] };

export function validateBody<S extends ZodTypeAny>(schema: S, body: unknown): ParseResult<S> {
  const result = schema.safeParse(body);
  if (result.success) {
    return { ok: true, data: result.data as z.infer<S> };
  }
  const fields: FieldIssue[] = result.error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '(root)',
    rule: issue.code,
  }));
  return { ok: false, fields };
}
