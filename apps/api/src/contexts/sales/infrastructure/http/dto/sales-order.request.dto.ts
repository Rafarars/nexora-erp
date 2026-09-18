import { z } from 'zod';

export const salesOrderRequestSchema = z.object({
  customerId: z.string(),
  warehouseId: z.string(),
  currency: z.string().nullable().optional(),
  exchangeRate: z.number().nullable().optional(),
  date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Con que lista se cotiza; sin ella, la del cliente o la de por defecto.
  priceListId: z.string().nullable().optional(),
  // Sin precio, manda el de la lista.
  lines: z.array(z.object({ itemId: z.string(), unitId: z.string(), quantity: z.number(), unitPrice: z.number().nullable().optional() })),
});

export type SalesOrderRequestDto = z.infer<typeof salesOrderRequestSchema>;
