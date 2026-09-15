import { z } from 'zod';

export const purchaseOrderRequestSchema = z.object({
  supplierId: z.string(),
  warehouseId: z.string(),
  date: z.string().nullable().optional(),
  expectedDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  exchangeRate: z.number().nullable().optional(),
  lines: z.array(
    z.object({
      itemId: z.string(),
      unitId: z.string(),
      quantity: z.number(),
      unitCost: z.number(),
    }),
  ),
});

export type PurchaseOrderRequestDto = z.infer<typeof purchaseOrderRequestSchema>;
