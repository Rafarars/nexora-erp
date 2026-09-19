import { z } from 'zod';

// En su propio archivo: la vigilancia de aislamiento lee el DTO de cada ruta para saber que
// identificadores acepta. Las fechas filtran por la de vencimiento y `status` es el estado de
// cobro: una factura anulada no se cobra y no entra en la lista.
export const receivableQuerySchema = z
  .object({
    q: z.string().optional(),
    customerId: z.string().optional(),
    status: z.enum(['pending', 'partially_paid', 'paid']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    onlyOverdue: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type ReceivableQueryDto = z.infer<typeof receivableQuerySchema>;
