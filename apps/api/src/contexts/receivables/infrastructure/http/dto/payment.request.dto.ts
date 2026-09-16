import { z } from 'zod';

// La empresa sale de la sesion; importes, fechas y metodo los valida el dominio.
export const paymentRequestSchema = z.object({
  customerId: z.string(),
  date: z.string().nullable().optional(),
  method: z.string(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  manualExchangeRate: z.number().nullable().optional(),
  allocations: z.array(z.object({ invoiceId: z.string(), amount: z.number() })),
});

export type PaymentRequestDto = z.infer<typeof paymentRequestSchema>;
