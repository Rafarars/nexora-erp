import { z } from 'zod';

const lines = z.array(z.object({ orderLineId: z.string(), quantity: z.number() }));

export const goodsReceiptCreateSchema = z.object({
  orderId: z.string(),
  date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines,
});

export type GoodsReceiptCreateDto = z.infer<typeof goodsReceiptCreateSchema>;

// La orden no viaja al editar: una entrada no cambia de orden.
export const goodsReceiptUpdateSchema = goodsReceiptCreateSchema.omit({ orderId: true });

export type GoodsReceiptUpdateDto = z.infer<typeof goodsReceiptUpdateSchema>;

export const incomingQuerySchema = z.object({ warehouseId: z.string().optional() });

export type IncomingQueryDto = z.infer<typeof incomingQuerySchema>;
