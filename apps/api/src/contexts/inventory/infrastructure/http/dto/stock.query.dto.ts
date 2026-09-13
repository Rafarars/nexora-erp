import { z } from 'zod';

export const stockQuerySchema = z.object({ warehouseId: z.string().optional() });

export type StockQueryDto = z.infer<typeof stockQuerySchema>;
