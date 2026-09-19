import { z } from 'zod';

export const switchTenantRequestSchema = z.object({
  tenantId: z.string().min(1),
})
  .strict();

export type SwitchTenantRequestDto = z.infer<typeof switchTenantRequestSchema>;
