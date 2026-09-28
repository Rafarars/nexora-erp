import { z } from 'zod';

export const creditNoteQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  salesReturnId: z.string().uuid().optional(),
  status: z.enum(['draft', 'confirmed', 'cancelled']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  text: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

export type CreditNoteQueryDto = z.infer<typeof creditNoteQuerySchema>;
