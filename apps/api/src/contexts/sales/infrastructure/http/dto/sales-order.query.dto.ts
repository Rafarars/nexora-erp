import { z } from 'zod';

// En su propio archivo: la vigilancia de aislamiento lee el DTO de cada ruta para saber que
// identificadores acepta. Las fechas filtran por la que declara el pedido.
export const salesOrderQuerySchema = z
  .object({
    q: z.string().optional(),
    customerId: z.string().optional(),
    warehouseId: z.string().optional(),
    status: z.enum(['draft', 'confirmed', 'partially_dispatched', 'dispatched', 'cancelled']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type SalesOrderQueryDto = z.infer<typeof salesOrderQuerySchema>;
