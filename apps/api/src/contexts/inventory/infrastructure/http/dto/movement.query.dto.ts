import { z } from 'zod';

// En su propio archivo: la vigilancia de aislamiento lee el DTO de cada ruta, y la bodega es un
// identificador que elige quien llama. Las fechas filtran por la que declara el documento.
export const movementQuerySchema = z.object({
  warehouseId: z.string().optional(),
  originType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type MovementQueryDto = z.infer<typeof movementQuerySchema>;
