/**
 * Full Registration form schema.
 *
 * Extends the Quick Add five fields with Priority, Assigned Servant,
 * Comments, plus an optional Reassignment-Reason for edit mode. Phone
 * normalization mirrors `quickAddSchema`: ASCII spaces are stripped
 * before E.164 validation. Comments are capped at 1000 characters
 * (decision in `add-full-registration` design § 3).
 */
import { z } from 'zod';

export const FULL_REG_LANGUAGES = ['en', 'ar', 'de'] as const;
export type FullRegLanguage = (typeof FULL_REG_LANGUAGES)[number];

export const FULL_REG_PRIORITIES = ['high', 'medium', 'low', 'very_low'] as const;
export type FullRegPriority = (typeof FULL_REG_PRIORITIES)[number];

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

const comments = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const trimmed = v.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string().max(1000).optional());

const assignedServant = z.string().uuid();

const reassignmentReason = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const trimmed = v.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string().max(200).optional());

export const fullRegistrationSchema = z.object({
  first_name: trimmedName,
  last_name: trimmedName,
  phone,
  region: trimmedRegion,
  language: z.enum(FULL_REG_LANGUAGES),
  priority: z.enum(FULL_REG_PRIORITIES),
  assigned_servant: assignedServant,
  comments,
  reassignment_reason: reassignmentReason,
});

export type FullRegistrationInput = z.input<typeof fullRegistrationSchema>;
export type FullRegistrationOutput = z.output<typeof fullRegistrationSchema>;
