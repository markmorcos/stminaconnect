/**
 * Quick Add form schema.
 *
 * Phone normalization rule: input is allowed to contain ASCII spaces
 * for readability (e.g. "+49 170 1234567"). The schema strips them
 * before validating against E.164 (`+\d{9,15}`). The normalized form
 * is what we send to `create_person` and `find_potential_duplicate`.
 */
import { z } from 'zod';

export const QUICK_ADD_LANGUAGES = ['en', 'ar', 'de'] as const;
export type QuickAddLanguage = (typeof QUICK_ADD_LANGUAGES)[number];

const trimmedName = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1).max(100));

const trimmedRegion = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const trimmed = v.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string().max(100).optional());

const phone = z
  .string()
  .transform((v) => v.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^\+\d{9,15}$/));

export const quickAddSchema = z.object({
  first_name: trimmedName,
  last_name: trimmedName,
  phone,
  region: trimmedRegion,
  language: z.enum(QUICK_ADD_LANGUAGES),
});

export type QuickAddInput = z.input<typeof quickAddSchema>;
export type QuickAddOutput = z.output<typeof quickAddSchema>;
