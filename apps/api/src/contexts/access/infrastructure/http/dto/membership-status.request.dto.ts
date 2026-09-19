import { z } from 'zod';

export const membershipStatusRequestSchema = z.object({ active: z.boolean() })
  .strict();

export type MembershipStatusRequestDto = z.infer<typeof membershipStatusRequestSchema>;
