import { z } from 'zod';

const returnConditions = ['resalable', 'damaged', 'scrap'] as const;

const returnLineSchema = z.object({
  id: z.string().optional(),
  dispatchLineId: z.string().nullable().optional(),
  itemId: z.string().optional(),
  unitId: z.string().optional(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative().optional(),
});

export const salesReturnCreateSchema = z.object({
  customerId: z.string(),
  dispatchId: z.string().nullable().optional(),
  warehouseId: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  exchangeRate: z.number().nullable().optional(),
  date: z.string().nullable().optional(),
  condition: z.enum(returnConditions),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(returnLineSchema).min(1),
});

export type SalesReturnCreateDto = z.infer<typeof salesReturnCreateSchema>;

export const salesReturnUpdateSchema = z.object({
  date: z.string().nullable().optional(),
  condition: z.enum(returnConditions),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(returnLineSchema).min(1),
});

export type SalesReturnUpdateDto = z.infer<typeof salesReturnUpdateSchema>;

