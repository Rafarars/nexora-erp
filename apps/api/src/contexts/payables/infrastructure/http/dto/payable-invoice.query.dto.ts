import { z } from 'zod';

export const payableInvoiceQuerySchema = z
  .object({
    q: z.string().optional(),
    supplierId: z.string().optional(),
    status: z.enum(['pending', 'partially_paid', 'paid']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    onlyOverdue: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type PayableInvoiceQueryDto = z.infer<typeof payableInvoiceQuerySchema>;
