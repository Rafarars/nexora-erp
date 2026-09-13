import { z } from 'zod';

// La empresa no viaja en el cuerpo: sale de la sesion. Los limites de largo los hace
// cumplir el dominio; aqui solo se asegura que llegan del tipo correcto.
export const categoryRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

export type CategoryRequestDto = z.infer<typeof categoryRequestSchema>;
