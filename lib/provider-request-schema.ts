import { z } from 'zod';

export const providerRequestSchema = z.object({
  business_name: z.string().trim().min(2).max(200),
  contact_number: z.string().trim().min(7).max(30).regex(/^\+?[\d\s().-]+$/),
  business_registration_number: z.string().trim().max(100).optional(),
  proof_of_ownership_url: z.string().url().max(2048).refine(value => new URL(value).protocol === 'https:', 'Proof must be an HTTPS URL'),
  place_id: z.number().int().positive().optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict();

export const providerReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().trim().min(1).max(2000),
}).strict();
