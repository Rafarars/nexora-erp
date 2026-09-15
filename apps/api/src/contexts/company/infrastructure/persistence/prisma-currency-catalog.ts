import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { Currency, CurrencyCatalog } from '../../domain/currency/currency-catalog.js';
import { CurrencyCode } from '../../domain/currency/currency-code.vo.js';

const COLUMNS = { code: true, name: true, symbol: true, decimals: true, isActive: true } as const;

@Injectable()
export class PrismaCurrencyCatalog implements CurrencyCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async searchAll(): Promise<Currency[]> {
    return this.prisma.currency.findMany({ select: COLUMNS, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
  }

  async find(code: CurrencyCode): Promise<Currency | null> {
    return this.prisma.currency.findUnique({ where: { code: code.value }, select: COLUMNS });
  }
}
