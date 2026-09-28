import { z } from 'zod';
import { CREDIT_NOTE_REASONS } from '../../../domain/credit-note/customer-credit-note.entity.js';

export const creditNoteLineRequestSchema = z.object({
  id: z.string().uuid().optional(),
  concept: z.string().trim().nullable().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative(),
}).strict();

export const creditNoteRequestSchema = z.object({
  customerId: z.string().uuid(),
  invoiceId: z.string().uuid().nullable().optional(),
  salesReturnId: z.string().uuid().nullable().optional(),
  date: z.string().nullable().optional(),
  reason: z.enum(CREDIT_NOTE_REASONS),
  reasonDetail: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  currency: z.string().trim().nullable().optional(),
  exchangeRate: z.number().positive().nullable().optional(),
  lines: z.array(creditNoteLineRequestSchema).min(1),
}).strict();

export type CreditNoteRequestDto = z.infer<typeof creditNoteRequestSchema>;
