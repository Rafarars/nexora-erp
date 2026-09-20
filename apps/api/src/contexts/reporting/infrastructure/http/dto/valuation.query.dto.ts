import { z } from 'zod';
import { pageQuery } from './report.query.dto.js';

// En su propio archivo: la vigilancia de aislamiento lee el DTO de cada ruta, y la bodega es un
// identificador que elige quien llama.
export const valuationQuerySchema = z.object({ warehouseId: z.string().optional(), format: z.string().optional() });

// La pantalla pagina; la exportacion, no.
export const pagedValuationQuerySchema = z.object({ warehouseId: z.string().optional(), ...pageQuery });

export type ValuationQueryDto = z.infer<typeof valuationQuerySchema>;
export type PagedValuationQueryDto = z.infer<typeof pagedValuationQuerySchema>;
