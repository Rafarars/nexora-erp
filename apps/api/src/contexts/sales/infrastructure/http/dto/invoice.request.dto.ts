import { z } from 'zod';

// Uno de los dos: el despacho que se cobra, o el pedido cuando solo vende servicios.
export const invoiceIssueSchema = z.object({
  dispatchId: z.string().nullable().optional(),
  orderId: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type InvoiceIssueDto = z.infer<typeof invoiceIssueSchema>;
