import { CurrencyCode } from '../currency/currency-code.vo.js';
import { LocalCurrencyRateError } from '../errors/company.errors.js';
import { optionalText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { ExchangeRateId } from './exchange-rate-id.vo.js';
import { RateDate } from './rate-date.vo.js';
import { RateType } from './rate-type.vo.js';
import { RateValue } from './rate-value.vo.js';

export const RATE_SOURCE_MAX = 150;

export interface ExchangeRatePrimitives {
  id: string;
  tenantId: string;
  currency: string;
  rateDate: string;
  type: string;
  rate: number;
  source: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExchangeRateInput {
  currency: string;
  rateDate: string;
  type: string;
  rate: number;
  source?: string | null;
}

// Lo que identifica una tasa dentro de la empresa: una sola por moneda, fecha y tipo.
export interface ExchangeRateKey {
  currency: CurrencyCode;
  rateDate: RateDate;
  type: RateType;
}

export interface ExchangeRateDetails {
  key: ExchangeRateKey;
  rate: RateValue;
  source: string | null;
}

// Todo valor invalido se rechaza antes de consultar nada.
export function exchangeRateDetailsOf(input: ExchangeRateInput): ExchangeRateDetails {
  const currency = CurrencyCode.of(input.currency);

  if (currency.isLocal()) throw new LocalCurrencyRateError(currency.value);

  return {
    key: { currency, rateDate: RateDate.of(input.rateDate), type: RateType.of(input.type) },
    rate: RateValue.of(input.rate),
    source: optionalText(input.source, RATE_SOURCE_MAX, 'ExchangeRateSource'),
  };
}

// Una tasa no se borra: los documentos que la usaron ya copiaron su valor. La cargada con error se
// corrige cargandola de nuevo, o se desactiva si no debia existir.
export class ExchangeRate {
  private constructor(
    readonly id: ExchangeRateId,
    readonly tenantId: TenantId,
    readonly key: ExchangeRateKey,
    private rate: RateValue,
    private source: string | null,
    private active: boolean,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static record(id: ExchangeRateId, tenantId: TenantId, details: ExchangeRateDetails, now: Date): ExchangeRate {
    return new ExchangeRate(id, tenantId, details.key, details.rate, details.source, true, now, now);
  }

  static fromPrimitives(row: ExchangeRatePrimitives): ExchangeRate {
    return new ExchangeRate(
      ExchangeRateId.of(row.id),
      TenantId.of(row.tenantId),
      { currency: CurrencyCode.of(row.currency), rateDate: RateDate.of(row.rateDate), type: RateType.of(row.type) },
      RateValue.of(row.rate),
      row.source,
      row.isActive,
      row.createdAt,
      row.updatedAt,
    );
  }

  toPrimitives(): ExchangeRatePrimitives {
    return {
      id: this.id.value,
      tenantId: this.tenantId.value,
      currency: this.key.currency.value,
      rateDate: this.key.rateDate.value,
      type: this.key.type.value,
      rate: this.rate.value,
      source: this.source,
      isActive: this.active,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // Cargar otra vez la misma moneda, fecha y tipo es decir cual es la buena: la reactiva si estaba
  // desactivada.
  correct(details: ExchangeRateDetails, now: Date): void {
    this.rate = details.rate;
    this.source = details.source;
    this.active = true;
    this.updatedAt = now;
  }

  deactivate(now: Date): void {
    this.active = false;
    this.updatedAt = now;
  }

  activate(now: Date): void {
    this.active = true;
    this.updatedAt = now;
  }

  isActive(): boolean {
    return this.active;
  }

  value(): number {
    return this.rate.value;
  }
}
