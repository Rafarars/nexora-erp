import { z } from 'zod';

// La moneda solo se elige al crear la lista: cambiarla despues reinterpretaria sus precios.
export const createPriceListRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  currency: z.string().length(3),
});

export const updatePriceListRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

export type CreatePriceListRequestDto = z.infer<typeof createPriceListRequestSchema>;
export type UpdatePriceListRequestDto = z.infer<typeof updatePriceListRequestSchema>;
