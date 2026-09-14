import { z } from 'zod';

const lines = z.array(z.object({ orderLineId: z.string(), quantity: z.number() }));

export const dispatchCreateSchema = z.object({
  orderId: z.string(),
  date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines,
});

export type DispatchCreateDto = z.infer<typeof dispatchCreateSchema>;

// El pedido no viaja al editar: un despacho no cambia de pedido.
export const dispatchUpdateSchema = dispatchCreateSchema.omit({ orderId: true });

export type DispatchUpdateDto = z.infer<typeof dispatchUpdateSchema>;
