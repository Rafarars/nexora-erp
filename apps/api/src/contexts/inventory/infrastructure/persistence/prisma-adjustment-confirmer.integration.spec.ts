import { ConfigService } from '@nestjs/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { AdjustmentFinder } from '../../domain/adjustment/find/adjustment-finder.js';
import { AdjustmentLineFactory } from '../../domain/adjustment/lines/adjustment-line-factory.js';
import { AdjustmentConfirmation } from '../../domain/adjustment/posting/adjustment-confirmation.js';
import { StockMovements } from '../../domain/stock/posting/stock-movements.js';
import { AdjustmentConfirmer } from '../../application/confirm-adjustment/adjustment-confirmer.js';
import { ANA, MAIN, NOW, PIECE, TENANT_A, TODAY, WATER } from '../../domain/testing/inventory.mother.js';
import { PrismaInventoryPortsHarness } from '../testing/prisma-inventory-ports.harness.js';
import { PrismaInventoryCatalog } from './prisma-inventory-catalog.js';
import { PrismaDocumentStockPosting } from './prisma-document-stock-posting.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required to run the test against PostgreSQL.');
  return url;
}

describe('AdjustmentConfirmer integration against PostgreSQL (H-H9-4)', () => {
  const harness = new PrismaInventoryPortsHarness();
  const prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  const ports = harness.ports();
  const ids = new SequentialIdGenerator();
  const docPosting = new PrismaDocumentStockPosting(ids);

  const finder = new AdjustmentFinder(ports.adjustments);
  const catalog = new PrismaInventoryCatalog(prisma);
  const factory = new AdjustmentLineFactory(catalog, ids);
  const confirmation = new AdjustmentConfirmation(new StockMovements(ids));
  const clock = { now: () => NOW };
  const calendar = { today: async () => TODAY };
  const confirmer = new AdjustmentConfirmer(
    finder,
    factory,
    ports.adjustments,
    ports.posting,
    confirmation,
    clock,
    calendar,
  );

  beforeEach(async () => {
    await harness.reset();
  });

  afterAll(async () => {
    await harness.close();
    await prisma.$disconnect();
  });

  it('confirms revaluation adjustment from purchase invoice, allocating stockPart and soldPart and writing kardex', async () => {
    // 1. Recepción previa en PostgreSQL: 10 unidades a costo 10.0 (valor = 100 USD)
    const receiptDoc = {
      type: 'receipt' as const,
      id: '00000000-0000-4000-8000-000000000101',
      date: TODAY,
    };
    const receiptLineId = '11111111-0000-4000-8000-000000000001';

    await prisma.$transaction(async (tx) => {
      await docPosting.receive(
        tx,
        TENANT_A,
        receiptDoc,
        [{ lineId: receiptLineId, itemId: WATER, warehouseId: MAIN, quantity: 10, unitCost: 10 }],
        NOW,
      );
    });

    const entryMovement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { tenantId: TENANT_A, originId: receiptDoc.id, direction: 'in' },
    });

    // 2. Crear un ajuste en borrador nacido de compras (originType: 'purchase_invoice')
    // con una revaluación por importe de +40 USD sobre la entrada previa
    const adjustmentId = 'ad000000-0000-4000-8000-000000000888';
    const invoiceId = 'fc000000-0000-4000-8000-000000000111';

    await prisma.adjustment.create({
      data: {
        id: adjustmentId,
        tenantId: TENANT_A,
        warehouseId: MAIN,
        code: 'AJU000888',
        adjustmentDate: new Date('2026-09-30T00:00:00Z'),
        type: 'revaluation',
        status: 'draft',
        notes: 'Diferencia de precio segun factura FCP000111',
        originType: 'purchase_invoice',
        originId: invoiceId,
        createdBy: ANA,
        lines: {
          create: [
            {
              id: '11111111-cccc-4ccc-8ccc-000000000888',
              lineNumber: 1,
              itemId: WATER,
              itemSku: 'AGUA-500',
              itemName: 'Agua mineral 500 ml',
              unitId: PIECE,
              direction: 'in',
              quantity: 0,
              baseQuantity: 0,
              revaluationKind: 'amount',
              amount: 40,
              sourceMovementId: entryMovement.id,
            },
          ],
        },
      },
    });

    // 3. Ejecutar AdjustmentConfirmer contra PostgreSQL
    await confirmer.run({
      tenantId: TENANT_A,
      adjustmentId,
      userId: ANA,
    });

    // 4. Verificar que el ajuste en PostgreSQL quedó confirmed con sus líneas por importe intactas
    const confirmedAdj = await prisma.adjustment.findUniqueOrThrow({
      where: { id: adjustmentId },
      include: { lines: true },
    });

    expect(confirmedAdj.status).toBe('confirmed');
    expect(confirmedAdj.lines).toHaveLength(1);
    const line = confirmedAdj.lines[0];
    expect(line.revaluationKind).toBe('amount');
    expect(Number(line.amount)).toBe(40);
    expect(Number(line.stockPart)).toBe(40);
    expect(Number(line.soldPart)).toBe(0);
    // Costo nuevo: (100 + 40) / 10 = 14 USD
    expect(Number(line.unitCost)).toBe(14);

    // 5. Verificar que el kardex en PostgreSQL escribió los movimientos de revaluación (out a 10, in a 14)
    const revalMovements = await prisma.inventoryMovement.findMany({
      where: { tenantId: TENANT_A, originId: adjustmentId },
      orderBy: { sequence: 'asc' },
    });

    expect(revalMovements).toHaveLength(2);
    expect(revalMovements[0].direction).toBe('out');
    expect(Number(revalMovements[0].unitCost)).toBe(10);
    expect(revalMovements[1].direction).toBe('in');
    expect(Number(revalMovements[1].unitCost)).toBe(14);
    expect(Number(revalMovements[1].balanceAverageCost)).toBe(14);

    // 6. Verificar la existencia actualizada en la tabla de stocks
    const stockRow = await prisma.itemStock.findUniqueOrThrow({
      where: { tenantId_itemId_warehouseId: { tenantId: TENANT_A, itemId: WATER, warehouseId: MAIN } },
    });
    expect(Number(stockRow.quantity)).toBe(10);
    expect(Number(stockRow.averageCost)).toBe(14);
  });
});
