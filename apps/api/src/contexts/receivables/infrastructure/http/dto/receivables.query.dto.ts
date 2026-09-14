import { z } from 'zod';

export const receivablesQuerySchema = z.object({ customerId: z.string().optional() });

export type ReceivablesQueryDto = z.infer<typeof receivablesQuerySchema>;
