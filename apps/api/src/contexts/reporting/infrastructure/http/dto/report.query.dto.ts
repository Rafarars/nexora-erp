import { z } from 'zod';

// Fechas y formato los valida el dominio: aqui solo se exige que lleguen como texto.
export const exportQuerySchema = z.object({ format: z.string().optional() });

export const periodQuerySchema = z.object({ from: z.string(), to: z.string(), format: z.string().optional() });

export type ExportQueryDto = z.infer<typeof exportQuerySchema>;
export type PeriodQueryDto = z.infer<typeof periodQuerySchema>;
