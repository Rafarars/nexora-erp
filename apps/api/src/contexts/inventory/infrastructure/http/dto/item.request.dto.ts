import { z } from 'zod';

export const itemRequestSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.string(),
  categoryId: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  isPurchasable: z.boolean().optional(),
  isSellable: z.boolean().optional(),
  salesTaxId: z.string().nullable().optional(),
  purchaseTaxId: z.string().nullable().optional(),
  units: z
    .array(
      z.object({
        unitId: z.string(),
        conversionFactor: z.number(),
        isBase: z.boolean(),
      }),
    )
    .min(1),
});

export type ItemRequestDto = z.infer<typeof itemRequestSchema>;
