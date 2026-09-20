import { z } from 'zod';
import { MAX_REPORT_PAGE } from '../../../domain/page/report-page.js';

// Fechas y formato los valida el dominio: aqui solo se exige que lleguen como texto.

// Solo digitos, y acotado. Con `z.coerce.number()` entraban "1.5" y hasta "0x10" (que vale 16), y
// la misma clase de entrada mala salia unas veces como ValidationError y otras como
// InvalidPageError, ya dentro del dominio.
const digits = (min: number, max: number) => z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(min).max(max)).optional();

// La pagina es de la pantalla: las exportaciones no la reciben y por eso salen completas, que es
// para lo que sirve un documento impreso.
export const pageQuery = { limit: digits(1, MAX_REPORT_PAGE), offset: digits(0, Number.MAX_SAFE_INTEGER) };

export const exportQuerySchema = z.object({ format: z.string().optional() });

export const pagedQuerySchema = z.object(pageQuery);

export const periodQuerySchema = z.object({ from: z.string(), to: z.string(), format: z.string().optional() });

export const pagedPeriodQuerySchema = z.object({ from: z.string(), to: z.string(), ...pageQuery });

export type ExportQueryDto = z.infer<typeof exportQuerySchema>;
export type PagedQueryDto = z.infer<typeof pagedQuerySchema>;
export type PeriodQueryDto = z.infer<typeof periodQuerySchema>;
export type PagedPeriodQueryDto = z.infer<typeof pagedPeriodQuerySchema>;
