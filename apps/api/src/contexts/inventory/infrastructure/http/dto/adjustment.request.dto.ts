import { z } from 'zod';

// La empresa sale de la sesion. Las reglas (bodega activa, unidad del articulo, cantidad
// positiva) las hace cumplir el dominio; aqui solo los tipos.
export const adjustmentRequestSchema = z.object({
  warehouseId: z.string(),
  type: z.string(),
  date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(
    z.object({
      itemId: z.string(),
      unitId: z.string(),
      // La revaluacion no mueve cantidad: sus lineas solo traen articulo y costo nuevo.
      direction: z.string().optional(),
      quantity: z.number().optional(),
      unitCost: z.number().nullable().optional(),
    }),
  ),
});

export type AdjustmentRequestDto = z.infer<typeof adjustmentRequestSchema>;
