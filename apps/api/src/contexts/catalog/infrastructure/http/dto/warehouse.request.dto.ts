import { z } from 'zod';

export const warehouseRequestSchema = z.object({
  name: z.string().min(1),
  address: z.string().nullable().optional(),
});

export type WarehouseRequestDto = z.infer<typeof warehouseRequestSchema>;
