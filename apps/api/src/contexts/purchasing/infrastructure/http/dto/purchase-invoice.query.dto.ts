import { z } from 'zod';

export const purchaseInvoiceQuerySchema = z
  .object({
    supplierId: z.string().uuid().optional(),
    status: z.enum(['draft', 'confirmed', 'cancelled']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type PurchaseInvoiceQueryDto = z.infer<typeof purchaseInvoiceQuerySchema>;
