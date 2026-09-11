import { z } from 'zod';

// El tenantId NO se acepta en el cuerpo: sale del token. Si se pudiera enviar,
// cualquiera daria de alta usuarios en la empresa de otro.
export const createUserRequestSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(8),
  name: z.string().min(1),
  roleIds: z.array(z.string()).optional(),
});

export type CreateUserRequestDto = z.infer<typeof createUserRequestSchema>;
