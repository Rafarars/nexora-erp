import { z } from 'zod';

// En su propio archivo: la vigilancia de aislamiento lee el DTO de cada ruta para saber que
// identificadores acepta. Las fechas filtran por la que declara el despacho.
export const dispatchQuerySchema = z
  .object({
    q: z.string().optional(),
    orderId: z.string().optional(),
    warehouseId: z.string().optional(),
    status: z.enum(['draft', 'confirmed', 'cancelled']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type DispatchQueryDto = z.infer<typeof dispatchQuerySchema>;
