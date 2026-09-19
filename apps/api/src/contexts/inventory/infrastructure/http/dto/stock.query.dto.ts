import { z } from 'zod';

// `q` busca por SKU y por nombre del articulo. Por defecto no se listan las filas en cero: una
// existencia agotada dice por donde paso el articulo, no que haya algo.
export const stockQuerySchema = z.object({
  q: z.string().optional(),
  warehouseId: z.string().optional(),
  includeEmpty: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type StockQueryDto = z.infer<typeof stockQuerySchema>;
