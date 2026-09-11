import { z } from 'zod';

// La longitud minima la valida tambien el dominio: esto solo sirve para responder
// 400 con un mensaje util antes de llegar alli.
export const passwordRequestSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8),
});

export type PasswordRequestDto = z.infer<typeof passwordRequestSchema>;
