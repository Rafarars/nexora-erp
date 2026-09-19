import { z } from 'zod';

// En su propio archivo: la vigilancia de aislamiento lee el DTO de cada ruta. `active` no viaja
// como identificador, asi que no abre ninguna via entre empresas.
export const customerQuerySchema = z
  .object({
    q: z.string().optional(),
    active: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type CustomerQueryDto = z.infer<typeof customerQuerySchema>;
