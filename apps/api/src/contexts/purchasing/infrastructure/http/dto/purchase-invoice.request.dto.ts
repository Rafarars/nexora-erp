import { z } from 'zod';

const lineSchema = z.object({
  id: z.string().uuid().optional(),
  receiptLineId: z.string().uuid().nullable().optional(),
  orderLineId: z.string().uuid().nullable().optional(),
  itemId: z.string().uuid().nullable().optional(),
  itemSku: z.string().nullable().optional(),
  itemName: z.string().nullable().optional(),
  concept: z.string().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative().optional(),
});

export const purchaseInvoiceCreateSchema = z
  .object({
    supplierId: z.string().uuid(),
    supplierInvoiceNumber: z.string().min(1).max(60),
    supplierInvoiceSeries: z.string().max(20).nullable().optional(),
    issueDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
    currency: z.string().nullable().optional(),
    exchangeRate: z.number().nullable().optional(),
    lines: z.array(lineSchema).min(1),
  })
  .strict();

export type PurchaseInvoiceCreateDto = z.infer<typeof purchaseInvoiceCreateSchema>;

export const purchaseInvoiceUpdateSchema = purchaseInvoiceCreateSchema;
export type PurchaseInvoiceUpdateDto = z.infer<typeof purchaseInvoiceUpdateSchema>;
