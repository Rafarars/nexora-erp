import { z } from 'zod';

export const assignRoleRequestSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
});

export type AssignRoleRequestDto = z.infer<typeof assignRoleRequestSchema>;
