import { z } from 'zod';

export const companyProfileRequestSchema = z.object({
  legalName: z.string(),
  tradeName: z.string().nullable().optional(),
  fiscalId: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

export type CompanyProfileRequestDto = z.infer<typeof companyProfileRequestSchema>;

export const companySettingsRequestSchema = z.object({
  baseCurrency: z.string(),
  secondaryCurrency: z.string().nullable().optional(),
  timeZone: z.string(),
  amountDecimals: z.number(),
  priceDecimals: z.number(),
});

export type CompanySettingsRequestDto = z.infer<typeof companySettingsRequestSchema>;
