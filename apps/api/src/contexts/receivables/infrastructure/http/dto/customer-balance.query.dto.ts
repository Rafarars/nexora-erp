import { z } from 'zod';

// En su propio archivo: la vigilancia de aislamiento lee el DTO de cada ruta. Ningun parametro
// viaja como identificador, asi que esta ruta no abre ninguna via entre empresas.
export const customerBalanceQuerySchema = z
  .object({
    q: z.string().optional(),
    onlyWithBalance: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type CustomerBalanceQueryDto = z.infer<typeof customerBalanceQuerySchema>;
