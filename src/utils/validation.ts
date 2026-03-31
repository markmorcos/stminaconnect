import { z } from 'zod';

export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .regex(/^\+[1-9]\d{7,14}$/, 'Must be in E.164 format (e.g. +491234567890)');

export const quickAddSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  phone: phoneSchema,
  region: z
    .string()
    .max(50)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || null),
  language: z.enum(['en', 'ar', 'de']),
});

export const fullRegistrationSchema = quickAddSchema.extend({
  priority: z.enum(['high', 'medium', 'low', 'very_low']).nullable(),
  assigned_servant_id: z.string().uuid('Please select an assigned servant'),
  comments: z
    .string()
    .max(500)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || null),
});

export type QuickAddInput = z.infer<typeof quickAddSchema>;
export type FullRegistrationInput = z.infer<typeof fullRegistrationSchema>;
