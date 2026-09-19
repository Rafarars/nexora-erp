import { z } from 'zod';

export const measurementUnitRequestSchema = z.object({
  name: z.string().min(1),
  abbreviation: z.string().min(1),
  // Si la unidad no admite fracciones. Por omision, las admite: es lo que hacian todas.
  mustBeWhole: z.boolean().optional(),
});

export type MeasurementUnitRequestDto = z.infer<typeof measurementUnitRequestSchema>;
