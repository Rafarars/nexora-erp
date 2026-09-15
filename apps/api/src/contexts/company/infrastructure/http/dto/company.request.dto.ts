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
  rateType: z.string(),
  allowsRateOverride: z.boolean(),
});

export type CompanySettingsRequestDto = z.infer<typeof companySettingsRequestSchema>;

export const exchangeRateRequestSchema = z.object({
  currency: z.string(),
  rateDate: z.string(),
  type: z.string(),
  // Un numero, no un texto: "36,50" se rechaza aqui con el campo senalado.
  rate: z.number(),
  source: z.string().nullable().optional(),
});

export type ExchangeRateRequestDto = z.infer<typeof exchangeRateRequestSchema>;

// Un filtro vacio en la URL (`?currency=`) es no filtrar.
const optionalFilter = z
  .string()
  .optional()
  .transform((value) => value || undefined);

export const exchangeRateQuerySchema = z.object({
  currency: optionalFilter,
  type: optionalFilter,
  from: optionalFilter,
  to: optionalFilter,
  date: optionalFilter,
});

export type ExchangeRateQueryDto = z.infer<typeof exchangeRateQuerySchema>;

export const rateStatusRequestSchema = z.object({ active: z.boolean() });

export type RateStatusRequestDto = z.infer<typeof rateStatusRequestSchema>;
