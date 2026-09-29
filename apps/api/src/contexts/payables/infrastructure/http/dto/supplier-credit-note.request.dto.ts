import { z } from 'zod';
import { CREDIT_NOTE_REASONS } from '../../../domain/credit-note/supplier-credit-note.entity.js';

export const supplierCreditNoteLineRequestSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid().nullable().optional(),
  itemSku: z.string().trim().nullable().optional(),
  itemName: z.string().trim().nullable().optional(),
  concept: z.string().trim().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative(),
}).strict();

export const supplierCreditNoteRequestSchema = z.object({
  supplierId: z.string().uuid(),
  invoiceId: z.string().uuid().nullable().optional(),
  purchaseReturnId: z.string().uuid().nullable().optional(),
  date: z.string().nullable().optional(),
  reason: z.enum(CREDIT_NOTE_REASONS),
  reasonDetail: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  currency: z.string().trim().nullable().optional(),
  exchangeRate: z.number().positive().nullable().optional(),
  lines: z.array(supplierCreditNoteLineRequestSchema).min(1),
}).strict();

export type SupplierCreditNoteRequestDto = z.infer<typeof supplierCreditNoteRequestSchema>;
