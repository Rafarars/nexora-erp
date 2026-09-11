import { z } from 'zod';

export const revokeRoleRequestSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
});

export type RevokeRoleRequestDto = z.infer<typeof revokeRoleRequestSchema>;
