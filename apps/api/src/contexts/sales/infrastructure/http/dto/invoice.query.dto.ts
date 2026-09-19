import { z } from 'zod';

// En su propio archivo: la vigilancia de aislamiento lee el DTO de cada ruta para saber que
// identificadores acepta. Las fechas filtran por la de emision.
export const invoiceQuerySchema = z
  .object({
    q: z.string().optional(),
    customerId: z.string().optional(),
    status: z.enum(['issued', 'cancelled']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type InvoiceQueryDto = z.infer<typeof invoiceQuerySchema>;
