import { z } from 'zod';
import { pageQuery } from './report.query.dto.js';

export const trialBalanceQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.string().optional(),
});

export const pagedTrialBalanceQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  ...pageQuery,
});

export type TrialBalanceQueryDto = z.infer<typeof trialBalanceQuerySchema>;
export type PagedTrialBalanceQueryDto = z.infer<typeof pagedTrialBalanceQuerySchema>;
