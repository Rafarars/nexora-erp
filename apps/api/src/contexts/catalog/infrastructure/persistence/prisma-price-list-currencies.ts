import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { PriceListCurrencies } from '../../domain/price-list/price-list-currencies.js';
import { CurrencyCode } from '../../domain/shared/currency-code.vo.js';

@Injectable()
export class PrismaPriceListCurrencies implements PriceListCurrencies {
  constructor(private readonly prisma: PrismaService) {}

  async isUsable(currency: CurrencyCode): Promise<boolean> {
    const row = await this.prisma.currency.findFirst({ where: { code: currency.value, isActive: true } });

    return row !== null;
  }
}
