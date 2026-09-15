import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { violates } from '../../../../shared/prisma/unique-violation.js';
import { CurrencyCode } from '../../domain/currency/currency-code.vo.js';
import { DuplicateExchangeRateError } from '../../domain/errors/company.errors.js';
import { ExchangeRateId } from '../../domain/rate/exchange-rate-id.vo.js';
import { ExchangeRate, ExchangeRateKey } from '../../domain/rate/exchange-rate.entity.js';
import { ExchangeRateFilter, ExchangeRateRepository, RATE_SEARCH_LIMIT } from '../../domain/rate/exchange-rate.repository.js';
import { RateDate } from '../../domain/rate/rate-date.vo.js';
import { RateType } from '../../domain/rate/rate-type.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

type RateRow = Awaited<ReturnType<PrismaService['exchangeRate']['findFirstOrThrow']>>;

const day = (date: RateDate) => new Date(`${date.value}T00:00:00.000Z`);

// La base guarda la tasa como decimal exacto; con siete enteros y ocho decimales cabe en un number
// sin perder nada.
function toDomain(row: RateRow): ExchangeRate {
  return ExchangeRate.fromPrimitives({ ...row, rate: row.rate.toNumber(), rateDate: row.rateDate.toISOString().slice(0, 10) });
}

@Injectable()
export class PrismaExchangeRateRepository implements ExchangeRateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(rate: ExchangeRate): Promise<void> {
    const { id, tenantId, currency, rateDate, type, rate: value, source, isActive, createdAt, updatedAt } = rate.toPrimitives();

    try {
      await this.prisma.exchangeRate.upsert({
        where: { tenantId_id: { tenantId, id } },
        create: { id, tenantId, currency, rateDate: day(rate.key.rateDate), type: rate.key.type.value, rate: value, source, isActive, createdAt, updatedAt },
        update: { rate: value, source, isActive, updatedAt },
      });
    } catch (error) {
      // La restriccion llega como campos, columnas o nombre del indice, segun el motor.
      if (violates(error, 'rateDate', 'rate_date') || violates(error, 'rateDate', 'currency_type_rate_date')) throw new DuplicateExchangeRateError(currency, type, rateDate);
      throw error;
    }
  }

  async find(tenantId: TenantId, id: ExchangeRateId): Promise<ExchangeRate | null> {
    const row = await this.prisma.exchangeRate.findFirst({ where: { id: id.value, tenantId: tenantId.value } });

    return row ? toDomain(row) : null;
  }

  async findByKey(tenantId: TenantId, key: ExchangeRateKey): Promise<ExchangeRate | null> {
    const row = await this.prisma.exchangeRate.findFirst({
      where: { tenantId: tenantId.value, currency: key.currency.value, type: key.type.value, rateDate: day(key.rateDate) },
    });

    return row ? toDomain(row) : null;
  }

  async latestOnOrBefore(tenantId: TenantId, currency: CurrencyCode, type: RateType, date: RateDate): Promise<ExchangeRate | null> {
    const row = await this.prisma.exchangeRate.findFirst({
      where: { tenantId: tenantId.value, currency: currency.value, type: type.value, isActive: true, rateDate: { lte: day(date) } },
      orderBy: { rateDate: 'desc' },
    });

    return row ? toDomain(row) : null;
  }

  async search(tenantId: TenantId, filter: ExchangeRateFilter): Promise<ExchangeRate[]> {
    const rows = await this.prisma.exchangeRate.findMany({
      where: {
        tenantId: tenantId.value,
        currency: filter.currency?.value,
        type: filter.type?.value,
        rateDate: { gte: filter.from ? day(filter.from) : undefined, lte: filter.to ? day(filter.to) : undefined },
      },
      orderBy: [{ rateDate: 'desc' }, { currency: 'asc' }, { type: 'asc' }],
      take: RATE_SEARCH_LIMIT,
    });

    return rows.map(toDomain);
  }
}
