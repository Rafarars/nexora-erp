import { z } from 'zod';

// La empresa sale de la sesion; las reglas (nombre, correo, plazo, limite) las hace cumplir el dominio.
export const customerRequestSchema = z.object({
  name: z.string(),
  fiscalId: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  paymentTermDays: z.number().nullable().optional(),
  creditLimit: z.number().nullable().optional(),
  // Con que lista se le cotiza; sin ella, la lista por defecto de la empresa.
  priceListId: z.string().nullable().optional(),
});

export type CustomerRequestDto = z.infer<typeof customerRequestSchema>;

export const statusRequestSchema = z.object({ active: z.boolean() });

export type StatusRequestDto = z.infer<typeof statusRequestSchema>;
