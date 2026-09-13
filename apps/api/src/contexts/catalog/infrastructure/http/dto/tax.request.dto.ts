import { z } from 'zod';

// Un numero, no un texto: "16%" o "16,5" se rechazan aqui con el campo senalado.
export const taxRequestSchema = z.object({
  name: z.string().min(1),
  rate: z.number(),
});

export type TaxRequestDto = z.infer<typeof taxRequestSchema>;
