import { z } from 'zod';

export const itemRequestSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.string(),
  categoryId: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  // Una regla por bodega: minimo, maximo opcional y cuanto pedir.
  reorderRules: z
    .array(
      z.object({
        warehouseId: z.string(),
        minQuantity: z.number(),
        maxQuantity: z.number().nullable().optional(),
        reorderQuantity: z.number(),
      }),
    )
    .optional(),
  // Un precio por lista, en la unidad base del articulo.
  prices: z
    .array(
      z.object({
        priceListId: z.string(),
        price: z.number(),
      }),
    )
    .optional(),
  // Piso de venta, en la moneda de la empresa.
  minPrice: z.number().nullable().optional(),
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
