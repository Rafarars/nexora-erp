import { describe, expect, it, vi } from 'vitest';
import { FixedDocumentRates } from '../../../../shared/infrastructure/testing/fixed-document-rates.js';
import type { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import type { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import type { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import type { DocumentAccountingPosting } from '../../../../shared/prisma/document-accounting-posting.js';
import type { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import {
  NoOpeningBalancesFoundError,
  OpeningBalanceAlreadyExistsError,
} from '../../domain/errors/accounting.errors.js';
import type {
  OpeningBalanceReader,
  OpeningBalanceTotals,
} from '../../domain/opening-balance/opening-balance-reader.js';
import { GenerateOpeningBalanceUseCase } from './generate-opening-balance.use-case.js';

describe('GenerateOpeningBalanceUseCase (§3.13)', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';

  function createHarness(options?: {
    hasOpening?: boolean;
    totals?: OpeningBalanceTotals;
    today?: string;
    decimals?: number;
    currency?: string;
  }) {
    const reader: OpeningBalanceReader = {
      hasOpeningBalance: vi.fn().mockResolvedValue(options?.hasOpening ?? false),
      readBalances: vi.fn().mockResolvedValue(
        options?.totals ?? {
          inventoryTotal: 100,
          receivablesTotal: 50,
          payablesTotal: 30,
        },
      ),
    };

    const posting: DocumentAccountingPosting = {
      post: vi.fn().mockResolvedValue(undefined),
    };

    const rates = new FixedDocumentRates();
    if (options?.decimals !== undefined) rates.decimals = options.decimals;
    if (options?.currency !== undefined) rates.baseCurrency = options.currency;

    const calendar: BusinessCalendar = {
      today: vi.fn().mockResolvedValue(options?.today ?? '2026-10-10'),
    };

    const idGen: IdGenerator = {
      next: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000099'),
    };

    const prisma = {
      $transaction: vi.fn().mockImplementation(async (callback) => callback({})),
    } as unknown as PrismaService;

    const useCase = new GenerateOpeningBalanceUseCase(
      reader,
      posting,
      rates,
      calendar,
      idGen,
      prisma,
    );

    return { useCase, reader, posting, rates, calendar, idGen, prisma };
  }

  it('rechaza si ya existe un asiento de apertura registrado para la empresa', async () => {
    const { useCase } = createHarness({ hasOpening: true });

    await expect(useCase.execute({ tenantId })).rejects.toThrow(OpeningBalanceAlreadyExistsError);
  });

  it('rechaza si todos los saldos vivos son cero', async () => {
    const { useCase } = createHarness({
      totals: { inventoryTotal: 0, receivablesTotal: 0, payablesTotal: 0 },
    });

    await expect(useCase.execute({ tenantId })).rejects.toThrow(NoOpeningBalancesFoundError);
  });

  it('calcula patrimonio de apertura positivo cuando Activo > Pasivo y publica el evento', async () => {
    const { useCase, posting } = createHarness({
      totals: { inventoryTotal: 100, receivablesTotal: 50, payablesTotal: 30 },
      today: '2026-10-10',
    });

    const result = await useCase.execute({ tenantId });

    // Activo (100 + 50) - Pasivo (30) = Patrimonio (120)
    expect(result.inventoryTotal).toBe(100);
    expect(result.receivablesTotal).toBe(50);
    expect(result.payablesTotal).toBe(30);
    expect(result.equityTotal).toBe(120);
    expect(result.date).toBe('2026-10-10');
    expect(result.currency).toBe('USD');

    expect(posting.post).toHaveBeenCalledWith(
      expect.anything(),
      tenantId,
      expect.objectContaining({
        kind: 'opening-balance',
        documentId: '00000000-0000-0000-0000-000000000099',
        date: '2026-10-10',
        currency: 'USD',
        inventoryTotal: 100,
        receivablesTotal: 50,
        payablesTotal: 30,
        equityTotal: 120,
      }),
    );
  });

  it('calcula patrimonio de apertura negativo (déficit) cuando Pasivo > Activo', async () => {
    const { useCase } = createHarness({
      totals: { inventoryTotal: 10, receivablesTotal: 20, payablesTotal: 70 },
    });

    const result = await useCase.execute({ tenantId });

    // Activo (10 + 20 = 30) - Pasivo (70) = Patrimonio (-40)
    expect(result.equityTotal).toBe(-40);
  });

  it('calcula patrimonio cero cuando Activo === Pasivo', async () => {
    const { useCase } = createHarness({
      totals: { inventoryTotal: 50, receivablesTotal: 50, payablesTotal: 100 },
    });

    const result = await useCase.execute({ tenantId });

    // Activo (100) - Pasivo (100) = 0
    expect(result.equityTotal).toBe(0);
  });

  it('respeta la fecha solicitada explícitamente en el comando', async () => {
    const { useCase, posting } = createHarness();

    const result = await useCase.execute({ tenantId, date: '2026-01-01' });

    expect(result.date).toBe('2026-01-01');
    expect(posting.post).toHaveBeenCalledWith(
      expect.anything(),
      tenantId,
      expect.objectContaining({ date: '2026-01-01' }),
    );
  });
});
