import { z } from 'zod';

// En su propio archivo: la vigilancia de aislamiento lee el DTO de cada ruta. `estado` no viaja
// como identificador, asi que no abre ninguna via entre empresas.
export const supplierQuerySchema = z
  .object({
    q: z.string().optional(),
    active: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type SupplierQueryDto = z.infer<typeof supplierQuerySchema>;
