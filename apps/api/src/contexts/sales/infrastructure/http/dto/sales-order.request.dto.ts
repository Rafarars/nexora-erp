import { z } from 'zod';

export const salesOrderRequestSchema = z.object({
  customerId: z.string(),
  warehouseId: z.string(),
  currency: z.string().nullable().optional(),
  exchangeRate: z.number().nullable().optional(),
  date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(z.object({ itemId: z.string(), unitId: z.string(), quantity: z.number(), unitPrice: z.number() })),
});

export type SalesOrderRequestDto = z.infer<typeof salesOrderRequestSchema>;
