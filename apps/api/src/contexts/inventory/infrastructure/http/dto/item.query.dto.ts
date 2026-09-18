import { z } from 'zod';

// `q` busca por codigo, SKU, nombre y codigo de barras. La pagina tiene tope duro: un listado
// entero de diez mil articulos no se pide por accidente.
export const itemQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type ItemQueryDto = z.infer<typeof itemQuerySchema>;
