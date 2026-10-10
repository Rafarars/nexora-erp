import { z } from 'zod';
import { ACCOUNT_TYPES } from '../../../domain/account/account-type.vo.js';

export const createAccountRequestSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  type: z.enum(ACCOUNT_TYPES as [string, ...string[]]),
  acceptsEntries: z.boolean(),
  parentId: z.string().uuid().nullable().optional(),
}).strict();

export type CreateAccountRequestDto = z.infer<typeof createAccountRequestSchema>;

export const updateAccountRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  acceptsEntries: z.boolean().optional(),
}).strict();

export type UpdateAccountRequestDto = z.infer<typeof updateAccountRequestSchema>;

export const searchAccountsQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
  type: z.enum(ACCOUNT_TYPES as [string, ...string[]]).optional(),
  tree: z.enum(['true', 'false']).optional(),
});

export type SearchAccountsQueryDto = z.infer<typeof searchAccountsQuerySchema>;
