import { Inject, Injectable } from '@nestjs/common';
import { amountUnits, roundRatio, unitsToNumber } from '../../../../shared/domain/amount.js';
import { PAYABLE_BALANCES, type PayableBalances } from '../../../../shared/prisma/payable-balances.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { RECEIVABLE_BALANCES, type ReceivableBalances } from '../../../../shared/prisma/receivable-balances.js';
import type {
  OpeningBalanceReader,
  OpeningBalanceTotals,
} from '../../domain/opening-balance/opening-balance-reader.js';

@Injectable()
export class PrismaOpeningBalanceReader implements OpeningBalanceReader {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RECEIVABLE_BALANCES) private readonly receivables: ReceivableBalances,
    @Inject(PAYABLE_BALANCES) private readonly payables: PayableBalances,
  ) {}

  async hasOpeningBalance(tenantId: string): Promise<boolean> {
    const count = await this.prisma.journalEntry.count({
      where: {
        tenantId,
        originType: 'opening_balance',
      },
    });

    return count > 0;
  }

  async readBalances(tenantId: string, decimals: number): Promise<OpeningBalanceTotals> {
    // 1. Clientes por cobrar: saldo vivo calculado exclusivamente por RECEIVABLE_BALANCES (H6)
    const receivablesTotal = await this.receivables.totalBalance(this.prisma, tenantId, decimals);

    // 2. Proveedores por pagar: saldo vivo calculado exclusivamente por PAYABLE_BALANCES (H9 §5.3)
    const payablesTotal = await this.payables.totalBalance(tenantId, decimals);

    // 3. Inventario en bodega: valuación al costo promedio de existencias activas
    const stocks = await this.prisma.itemStock.findMany({
      where: {
        tenantId,
        quantity: { not: 0 },
      },
      select: {
        quantity: true,
        averageCost: true,
      },
    });

    const inventoryUnits = stocks.reduce((sum, row) => {
      const rowValuation = roundRatio(
        amountUnits(Number(row.quantity)) * BigInt(Math.round(Number(row.averageCost) * 1_000_000)),
        1_000_000n,
        decimals,
      );
      return sum + rowValuation;
    }, 0n);

    const inventoryTotal = unitsToNumber(inventoryUnits);

    return {
      inventoryTotal,
      receivablesTotal,
      payablesTotal,
    };
  }
}
