import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import type { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import type { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import type { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import type { DocumentAccountingPosting } from '../../../../shared/prisma/document-accounting-posting.js';
import type { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import {
  NoOpeningBalancesFoundError,
  OpeningBalanceAlreadyExistsError,
} from '../../domain/errors/accounting.errors.js';
import type { OpeningBalanceReader } from '../../domain/opening-balance/opening-balance-reader.js';

export interface GenerateOpeningBalanceCommand {
  tenantId: string;
  date?: string;
}

export interface GenerateOpeningBalanceResult {
  date: string;
  currency: string;
  inventoryTotal: number;
  receivablesTotal: number;
  payablesTotal: number;
  equityTotal: number;
}

export class GenerateOpeningBalanceUseCase {
  constructor(
    private readonly reader: OpeningBalanceReader,
    private readonly posting: DocumentAccountingPosting,
    private readonly rates: DocumentRates,
    private readonly calendar: BusinessCalendar,
    private readonly idGen: IdGenerator,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: GenerateOpeningBalanceCommand): Promise<GenerateOpeningBalanceResult> {
    const exists = await this.reader.hasOpeningBalance(command.tenantId);
    if (exists) {
      throw new OpeningBalanceAlreadyExistsError();
    }

    const [decimals, currency, today] = await Promise.all([
      this.rates.amountDecimals(command.tenantId),
      this.rates.companyCurrency(command.tenantId),
      this.calendar.today(command.tenantId),
    ]);

    const date = command.date ?? today;
    const { inventoryTotal, receivablesTotal, payablesTotal } = await this.reader.readBalances(
      command.tenantId,
      decimals,
    );

    if (inventoryTotal === 0 && receivablesTotal === 0 && payablesTotal === 0) {
      throw new NoOpeningBalancesFoundError();
    }

    // Ecuación contable fundamental (§3.13): Activo − Pasivo = Patrimonio
    // Activo = Inventario + Clientes por cobrar
    // Pasivo = Proveedores por pagar
    const assetUnits = amountUnits(inventoryTotal) + amountUnits(receivablesTotal);
    const liabilityUnits = amountUnits(payablesTotal);
    const equityUnits = assetUnits - liabilityUnits;
    const equityTotal = unitsToNumber(equityUnits);

    const documentId = this.idGen.next();

    await this.prisma.$transaction(async (tx) => {
      await this.posting.post(tx, command.tenantId, {
        kind: 'opening-balance',
        documentId,
        date,
        currency,
        inventoryTotal,
        receivablesTotal,
        payablesTotal,
        equityTotal,
      });
    });

    return {
      date,
      currency,
      inventoryTotal,
      receivablesTotal,
      payablesTotal,
      equityTotal,
    };
  }
}
