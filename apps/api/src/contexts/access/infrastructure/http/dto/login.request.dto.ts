import { z } from 'zod';

export const loginRequestSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  tenantSlug: z.string().min(1).optional(),
});

export type LoginRequestDto = z.infer<typeof loginRequestSchema>;
