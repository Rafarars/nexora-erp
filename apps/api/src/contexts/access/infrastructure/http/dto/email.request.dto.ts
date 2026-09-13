import { z } from 'zod';

export const emailRequestSchema = z.object({
  current: z.string().min(1),
  email: z.string().min(1),
});

export type EmailRequestDto = z.infer<typeof emailRequestSchema>;
