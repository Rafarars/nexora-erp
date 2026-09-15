import type { CompanyProfile, CompanySettings, Currency } from './company';

export interface CompanySettingsInput {
  baseCurrency: string;
  secondaryCurrency: string | null;
  timeZone: string;
  amountDecimals: number;
  priceDecimals: number;
}

// El puerto de la empresa. Las pantallas no saben de fetch ni de rutas de la API.
export interface CompanyApi {
  profile(token: string): Promise<CompanyProfile>;
  saveProfile(token: string, input: CompanyProfile): Promise<void>;
  settings(token: string): Promise<CompanySettings>;
  saveSettings(token: string, input: CompanySettingsInput): Promise<void>;
  currencies(token: string): Promise<Currency[]>;
}
