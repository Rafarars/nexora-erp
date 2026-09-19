import { z } from 'zod';

// En su propio archivo: compartirlo con el de facturas le daba parametros que aqui no
// significan nada, y la vigilancia de aislamiento lee el DTO de cada ruta.
export const availabilityQuerySchema = z
  .object({
    q: z.string().optional(),
    warehouseId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type AvailabilityQueryDto = z.infer<typeof availabilityQuerySchema>;
