import { z } from 'zod';

export const searchJournalEntriesQuerySchema = z.object({
  originType: z.string().optional(),
  originId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  accountId: z.string().uuid().optional(),
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type SearchJournalEntriesQueryDto = z.infer<typeof searchJournalEntriesQuerySchema>;
