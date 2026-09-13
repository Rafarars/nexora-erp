import { z } from 'zod';

export const statusRequestSchema = z.object({ active: z.boolean() });

export type StatusRequestDto = z.infer<typeof statusRequestSchema>;
