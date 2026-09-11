import { z } from 'zod';

// El tenantId no aparece: sale de la sesion, como en todos los demas.
export const roleRequestSchema = z.object({
  name: z.string().min(1),
  permissions: z.array(z.string()).default([]),
});

export type RoleRequestDto = z.infer<typeof roleRequestSchema>;
