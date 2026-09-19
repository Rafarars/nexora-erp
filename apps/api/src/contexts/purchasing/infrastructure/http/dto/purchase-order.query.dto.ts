import { z } from 'zod';

// En su propio archivo: la vigilancia de aislamiento lee el DTO de cada ruta para saber que
// identificadores acepta. Las fechas filtran por la que declara la orden.
export const purchaseOrderQuerySchema = z
  .object({
    q: z.string().optional(),
    supplierId: z.string().optional(),
    warehouseId: z.string().optional(),
    status: z.enum(['draft', 'confirmed', 'partially_received', 'received', 'cancelled']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type PurchaseOrderQueryDto = z.infer<typeof purchaseOrderQuerySchema>;
