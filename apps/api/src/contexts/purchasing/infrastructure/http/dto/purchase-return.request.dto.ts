import { z } from 'zod';

const returnLines = z.array(
  z.object({
    id: z.string().optional(),
    receiptLineId: z.string(),
    quantity: z.number().positive(),
  }),
);

export const purchaseReturnCreateSchema = z
  .object({
    supplierId: z.string(),
    receiptId: z.string(),
    date: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    lines: returnLines,
  })
  .strict();

export type PurchaseReturnCreateDto = z.infer<typeof purchaseReturnCreateSchema>;

export const purchaseReturnUpdateSchema = z
  .object({
    date: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    lines: returnLines,
  })
  .strict();

export type PurchaseReturnUpdateDto = z.infer<typeof purchaseReturnUpdateSchema>;
