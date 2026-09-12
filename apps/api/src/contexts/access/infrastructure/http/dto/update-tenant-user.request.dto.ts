import { z } from 'zod';

// Sin correo ni contrasena: el administrador de una empresa no puede tocar la llave
// de una cuenta que tambien entra en otras.
export const updateTenantUserRequestSchema = z.object({
  name: z.string().min(1),
  roleIds: z.array(z.string()).default([]),
});

export type UpdateTenantUserRequestDto = z.infer<typeof updateTenantUserRequestSchema>;
