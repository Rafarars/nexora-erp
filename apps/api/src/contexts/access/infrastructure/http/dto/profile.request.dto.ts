import { z } from 'zod';

export const profileRequestSchema = z.object({
  name: z.string().min(1),
})
  .strict();

export type ProfileRequestDto = z.infer<typeof profileRequestSchema>;
