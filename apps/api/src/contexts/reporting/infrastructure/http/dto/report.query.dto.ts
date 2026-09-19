import { z } from 'zod';

// Fechas y formato los valida el dominio: aqui solo se exige que lleguen como texto.
// La pagina es de la pantalla: las exportaciones no la reciben y por eso salen completas, que es
// para lo que sirve un documento impreso.
const page = { limit: z.coerce.number().optional(), offset: z.coerce.number().optional() };

export const exportQuerySchema = z.object({ format: z.string().optional() });

export const pagedQuerySchema = z.object(page);

export const periodQuerySchema = z.object({ from: z.string(), to: z.string(), format: z.string().optional() });

export const pagedPeriodQuerySchema = z.object({ from: z.string(), to: z.string(), ...page });

export type ExportQueryDto = z.infer<typeof exportQuerySchema>;
export type PagedQueryDto = z.infer<typeof pagedQuerySchema>;
export type PeriodQueryDto = z.infer<typeof periodQuerySchema>;
export type PagedPeriodQueryDto = z.infer<typeof pagedPeriodQuerySchema>;
