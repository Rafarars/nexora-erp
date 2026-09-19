import { z } from 'zod';

// `q` busca por codigo y por notas. La pagina tiene tope duro: el listado entero de una
// empresa con anos de ajustes no se pide por accidente. En su propio archivo porque la
// vigilancia de aislamiento lee el DTO de cada ruta, y la bodega es un identificador que
// elige quien llama.
export const adjustmentQuerySchema = z.object({
  q: z.string().optional(),
  warehouseId: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type AdjustmentQueryDto = z.infer<typeof adjustmentQuerySchema>;
