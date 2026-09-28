import { z } from 'zod';

export const purchaseReturnQuerySchema = z
  .object({
    q: z.string().optional(),
    supplierId: z.string().optional(),
    receiptId: z.string().optional(),
    warehouseId: z.string().optional(),
    status: z.enum(['draft', 'confirmed', 'cancelled']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type PurchaseReturnQueryDto = z.infer<typeof purchaseReturnQuerySchema>;
