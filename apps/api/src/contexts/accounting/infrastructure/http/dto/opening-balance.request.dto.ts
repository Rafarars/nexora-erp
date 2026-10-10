import { z } from 'zod';

export const generateOpeningBalanceRequestSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),
});

export type GenerateOpeningBalanceRequestDto = z.infer<typeof generateOpeningBalanceRequestSchema>;
