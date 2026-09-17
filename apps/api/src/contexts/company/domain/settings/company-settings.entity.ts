import { CurrencyCode } from '../currency/currency-code.vo.js';
import { RateType } from '../rate/rate-type.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { DecimalPlaces } from './decimal-places.vo.js';
import { TimeZone } from './time-zone.vo.js';

// Los importes se guardan con cuatro decimales como maximo y los precios con seis.
export const AMOUNT_DECIMALS_MAX = 4;
export const PRICE_DECIMALS_MAX = 6;

// Lo que tiene una empresa que nunca la configuro: la politica del companero, pensada para Venezuela.
export const DEFAULT_SETTINGS = {
  baseCurrency: 'USD',
  secondaryCurrency: 'VES',
  timeZone: 'America/Caracas',
  amountDecimals: 2,
  priceDecimals: 6,
  rateType: 'legal',
  allowsRateOverride: true,
} as const;

export interface CompanySettingsPrimitives {
  tenantId: string;
  baseCurrency: string;
  secondaryCurrency: string | null;
  timeZone: string;
  amountDecimals: number;
  priceDecimals: number;
  // La serie de tasas que valora los documentos.
  rateType: string;
  // Si un documento puede llevar una tasa escrita a mano.
  allowsRateOverride: boolean;
  updatedAt: Date | null;
}

export interface CompanySettingsDetails {
  baseCurrency: CurrencyCode;
  secondaryCurrency: CurrencyCode | null;
  timeZone: TimeZone;
  amountDecimals: DecimalPlaces;
  priceDecimals: DecimalPlaces;
  rateType: RateType;
  allowsRateOverride: boolean;
}

export interface CompanySettingsInput {
  baseCurrency: string;
  secondaryCurrency?: string | null;
  timeZone: string;
  amountDecimals: number;
  priceDecimals: number;
  rateType: string;
  allowsRateOverride: boolean;
}

// Todo valor invalido se rechaza antes de consultar nada.
export function settingsDetailsOf(input: CompanySettingsInput): CompanySettingsDetails {
  return {
    baseCurrency: CurrencyCode.of(input.baseCurrency),
    secondaryCurrency: input.secondaryCurrency ? CurrencyCode.of(input.secondaryCurrency) : null,
    timeZone: TimeZone.of(input.timeZone),
    amountDecimals: DecimalPlaces.of(input.amountDecimals, AMOUNT_DECIMALS_MAX, 'AmountDecimals'),
    priceDecimals: DecimalPlaces.of(input.priceDecimals, PRICE_DECIMALS_MAX, 'PriceDecimals'),
    rateType: RateType.of(input.rateType),
    allowsRateOverride: input.allowsRateOverride,
  };
}

// Una sola por empresa. No se crea a mano ni se borra: la que no existe vale lo de DEFAULT_SETTINGS.
export class CompanySettings {
  private constructor(
    readonly tenantId: TenantId,
    private details: CompanySettingsDetails,
    private updatedAt: Date | null,
  ) {}

  static defaults(tenantId: TenantId): CompanySettings {
    return new CompanySettings(tenantId, settingsDetailsOf(DEFAULT_SETTINGS), null);
  }

  static fromPrimitives(row: CompanySettingsPrimitives): CompanySettings {
    return new CompanySettings(TenantId.of(row.tenantId), settingsDetailsOf(row), row.updatedAt);
  }

  toPrimitives(): CompanySettingsPrimitives {
    const { baseCurrency, secondaryCurrency, timeZone, amountDecimals, priceDecimals, rateType, allowsRateOverride } = this.details;

    return {
      tenantId: this.tenantId.value,
      baseCurrency: baseCurrency.value,
      secondaryCurrency: secondaryCurrency?.value ?? null,
      timeZone: timeZone.value,
      amountDecimals: amountDecimals.value,
      priceDecimals: priceDecimals.value,
      rateType: rateType.value,
      allowsRateOverride,
      updatedAt: this.updatedAt,
    };
  }

  update(details: CompanySettingsDetails, now: Date): void {
    this.details = details;
    this.updatedAt = now;
  }

  changesBaseCurrency(details: CompanySettingsDetails): boolean {
    return !details.baseCurrency.equals(this.details.baseCurrency);
  }

  lowersDecimals(details: CompanySettingsDetails): boolean {
    return details.amountDecimals.value < this.details.amountDecimals.value || details.priceDecimals.value < this.details.priceDecimals.value;
  }

  baseCurrency(): CurrencyCode {
    return this.details.baseCurrency;
  }

  secondaryCurrency(): CurrencyCode | null {
    return this.details.secondaryCurrency;
  }

  rateType(): RateType {
    return this.details.rateType;
  }

  allowsRateOverride(): boolean {
    return this.details.allowsRateOverride;
  }

  // Con la misma moneda principal y secundaria no hay nada que convertir.
  usesDualCurrency(): boolean {
    return this.details.secondaryCurrency !== null && !this.details.secondaryCurrency.equals(this.details.baseCurrency);
  }

  todayAt(now: Date): string {
    return this.details.timeZone.todayAt(now);
  }
}
