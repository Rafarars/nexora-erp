import { z } from 'zod';

const returnConditions = ['resalable', 'damaged', 'scrap'] as const;

const returnLines = z.array(
  z.object({
    id: z.string().optional(),
    dispatchLineId: z.string(),
    quantity: z.number().positive(),
  }),
);


export const salesReturnCreateSchema = z.object({
  customerId: z.string(),
  dispatchId: z.string(),
  date: z.string().nullable().optional(),
  condition: z.enum(returnConditions),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: returnLines,
});

export type SalesReturnCreateDto = z.infer<typeof salesReturnCreateSchema>;

export const salesReturnUpdateSchema = z.object({
  date: z.string().nullable().optional(),
  condition: z.enum(returnConditions),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: returnLines,
});

export type SalesReturnUpdateDto = z.infer<typeof salesReturnUpdateSchema>;
