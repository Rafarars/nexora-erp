import { z } from 'zod';

// En su propio archivo: la vigilancia de aislamiento lee el DTO de cada ruta, y la bodega es un
// identificador que elige quien llama.
export const valuationQuerySchema = z.object({ warehouseId: z.string().optional(), format: z.string().optional() });

export type ValuationQueryDto = z.infer<typeof valuationQuerySchema>;
