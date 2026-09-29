import { z } from 'zod';

export const supplierBalanceQuerySchema = z
  .object({
    q: z.string().optional(),
    onlyWithBalance: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export type SupplierBalanceQueryDto = z.infer<typeof supplierBalanceQuerySchema>;
