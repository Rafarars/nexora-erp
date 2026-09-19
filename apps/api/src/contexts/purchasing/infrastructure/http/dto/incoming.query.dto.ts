import { z } from 'zod';

// En su propio archivo: compartirlo con el de entradas le daba parametros que aqui no
// significan nada, y la vigilancia de aislamiento lee el DTO de cada ruta.
export const incomingQuerySchema = z
  .object({
    warehouseId: z.string().optional(),
    q: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type IncomingQueryDto = z.infer<typeof incomingQuerySchema>;
