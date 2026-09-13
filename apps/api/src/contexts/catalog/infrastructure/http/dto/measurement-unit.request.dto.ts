import { z } from 'zod';

export const measurementUnitRequestSchema = z.object({
  name: z.string().min(1),
  abbreviation: z.string().min(1),
});

export type MeasurementUnitRequestDto = z.infer<typeof measurementUnitRequestSchema>;
