import { z } from 'zod';

export const invoiceIssueSchema = z.object({
  dispatchId: z.string(),
  date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type InvoiceIssueDto = z.infer<typeof invoiceIssueSchema>;

export const availabilityQuerySchema = z.object({ warehouseId: z.string().optional() });

export type AvailabilityQueryDto = z.infer<typeof availabilityQuerySchema>;
