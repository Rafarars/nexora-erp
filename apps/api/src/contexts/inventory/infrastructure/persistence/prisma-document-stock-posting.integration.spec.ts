import { ConfigService } from '@nestjs/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { MAIN, NOW, TENANT_A, TODAY, WATER } from '../../domain/testing/inventory.mother.js';
import { PrismaInventoryPortsHarness } from '../testing/prisma-inventory-ports.harness.js';
import { PrismaDocumentStockPosting } from './prisma-document-stock-posting.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required to run the test against PostgreSQL.');
  return url;
}

describe('PrismaDocumentStockPosting integration: restore and frozen cost (H8 §3.8)', () => {
  const harness = new PrismaInventoryPortsHarness();
  const prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  const posting = new PrismaDocumentStockPosting(new SequentialIdGenerator());

  beforeEach(async () => {
    await harness.reset();
  });

  afterAll(async () => {
    await harness.close();
    await prisma.$disconnect();
  });

  it('restores purchase receipt lines at their frozen cost and updates average cost', async () => {
    const receiptDoc = {
      type: 'receipt' as const,
      id: '00000000-0000-4000-8000-000000000101',
      date: TODAY,
    };
    const lineId1 = '11111111-0000-4000-8000-000000000001';

    // 1. Recepcion de compra: 10 unidades a costo 2.0
    await prisma.$transaction(async (tx) => {
      await posting.receive(
        tx,
        TENANT_A,
        receiptDoc,
        [{ lineId: lineId1, itemId: WATER, warehouseId: MAIN, quantity: 10, unitCost: 2 }],
        NOW,
      );
    });

    // 2. Segunda recepcion: 10 unidades a costo 4.0 (promedio resultante = 3.0, saldo = 20)
    const receiptDoc2 = {
      type: 'receipt' as const,
      id: '00000000-0000-4000-8000-000000000102',
      date: TODAY,
    };
    const lineId2 = '11111111-0000-4000-8000-000000000002';
    await prisma.$transaction(async (tx) => {
      await posting.receive(
        tx,
        TENANT_A,
        receiptDoc2,
        [{ lineId: lineId2, itemId: WATER, warehouseId: MAIN, quantity: 10, unitCost: 4 }],
        NOW,
      );
    });

    // Verificar existencias antes de devolver
    const stockBefore = await prisma.itemStock.findUniqueOrThrow({
      where: { tenantId_itemId_warehouseId: { tenantId: TENANT_A, itemId: WATER, warehouseId: MAIN } },
    });
    expect(Number(stockBefore.quantity)).toBe(20);
    expect(Number(stockBefore.averageCost)).toBe(3);

    // 3. movementsOf lee los movimientos de la segunda recepcion
    const movements = await prisma.$transaction(async (tx) => {
      return posting.movementsOf(tx, TENANT_A, 'receipt', receiptDoc2.id);
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].unitCost).toBe(4);
    expect(movements[0].quantity).toBe(10);

    // 4. Devolucion de compra: devuelve 5 unidades de la segunda recepcion al costo congelado de 4.0
    const returnDoc = {
      type: 'purchase_return' as const,
      id: '00000000-0000-4000-8000-000000000201',
      date: TODAY,
    };
    const returnLineId = '22222222-0000-4000-8000-000000000001';

    await prisma.$transaction(async (tx) => {
      await posting.restore(
        tx,
        TENANT_A,
        returnDoc,
        [{ lineId: returnLineId, itemId: WATER, warehouseId: MAIN, quantity: 5, originalMovementId: movements[0].id }],
        NOW,
      );
    });

    // 5. Verificar que el kardex tiene el movimiento con restoresMovementId
    const returnMovement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { tenantId: TENANT_A, originType: 'purchase_return', originId: returnDoc.id },
    });
    expect(returnMovement.direction).toBe('out');
    expect(Number(returnMovement.quantity)).toBe(5);
    expect(Number(returnMovement.unitCost)).toBe(4);
    expect(returnMovement.reversalOfId).toBeNull();
    expect(returnMovement.restoresMovementId).toBe(movements[0].id);

    // 6. Verificar el promedio ponderado de la existencia segun H8 §3.8:
    // Quedan 15 unidades. Valor remanente = 60 - (5 * 4) = 40. Nuevo costo promedio = 40 / 15 = 2.666667
    const stockAfter = await prisma.itemStock.findUniqueOrThrow({
      where: { tenantId_itemId_warehouseId: { tenantId: TENANT_A, itemId: WATER, warehouseId: MAIN } },
    });
    expect(Number(stockAfter.quantity)).toBe(15);
    expect(Number(stockAfter.averageCost)).toBe(2.666667);

    // 7. Anular la devolucion revierte el movimiento y restablece la existencia y el promedio
    await prisma.$transaction(async (tx) => {
      await posting.reverse(tx, TENANT_A, returnDoc, NOW);
    });

    const stockRestored = await prisma.itemStock.findUniqueOrThrow({
      where: { tenantId_itemId_warehouseId: { tenantId: TENANT_A, itemId: WATER, warehouseId: MAIN } },
    });
    expect(Number(stockRestored.quantity)).toBe(20);
    expect(Number(stockRestored.averageCost)).toBe(3);
  });

  it('restores sales dispatch lines at their frozen cost and updates average cost', async () => {
    // 1. Recepcion inicial: 10 unidades a costo 2.0
    const receiptDoc = {
      type: 'receipt' as const,
      id: '00000000-0000-4000-8000-000000000103',
      date: TODAY,
    };
    await prisma.$transaction(async (tx) => {
      await posting.receive(
        tx,
        TENANT_A,
        receiptDoc,
        [{ lineId: '11111111-0000-4000-8000-000000000003', itemId: WATER, warehouseId: MAIN, quantity: 10, unitCost: 2 }],
        NOW,
      );
    });

    // 2. Despacho de venta: 6 unidades (salen a costo promedio 2.0)
    const dispatchDoc = {
      type: 'dispatch' as const,
      id: '00000000-0000-4000-8000-000000000104',
      date: TODAY,
    };
    await prisma.$transaction(async (tx) => {
      await posting.release(
        tx,
        TENANT_A,
        dispatchDoc,
        [{ lineId: '11111111-0000-4000-8000-000000000004', itemId: WATER, warehouseId: MAIN, quantity: 6 }],
        NOW,
      );
    });

    // Leer movimiento del despacho
    const dispatchMovements = await prisma.$transaction(async (tx) => {
      return posting.movementsOf(tx, TENANT_A, 'dispatch', dispatchDoc.id);
    });
    expect(dispatchMovements).toHaveLength(1);
    expect(dispatchMovements[0].unitCost).toBe(2);

    // 3. Recepcion adicional a costo 5.0 (quedaban 4 a 2.0 + 4 a 5.0 = 28 / 8 = 3.5 promedio)
    const receiptDoc2 = {
      type: 'receipt' as const,
      id: '00000000-0000-4000-8000-000000000105',
      date: TODAY,
    };
    await prisma.$transaction(async (tx) => {
      await posting.receive(
        tx,
        TENANT_A,
        receiptDoc2,
        [{ lineId: '11111111-0000-4000-8000-000000000005', itemId: WATER, warehouseId: MAIN, quantity: 4, unitCost: 5 }],
        NOW,
      );
    });

    const stockBeforeReturn = await prisma.itemStock.findUniqueOrThrow({
      where: { tenantId_itemId_warehouseId: { tenantId: TENANT_A, itemId: WATER, warehouseId: MAIN } },
    });
    expect(Number(stockBeforeReturn.quantity)).toBe(8);
    expect(Number(stockBeforeReturn.averageCost)).toBe(3.5);

    // 4. Devolucion de venta: entran 2 unidades al costo congelado del despacho (2.0)
    const returnDoc = {
      type: 'sales_return' as const,
      id: '00000000-0000-4000-8000-000000000202',
      date: TODAY,
    };
    await prisma.$transaction(async (tx) => {
      await posting.restore(
        tx,
        TENANT_A,
        returnDoc,
        [{ lineId: '22222222-0000-4000-8000-000000000002', itemId: WATER, warehouseId: MAIN, quantity: 2, originalMovementId: dispatchMovements[0].id }],
        NOW,
      );
    });

    // Nuevo stock: 10 unidades. Valor = 8 * 3.5 + 2 * 2.0 = 32. Promedio = 3.2
    const stockAfterReturn = await prisma.itemStock.findUniqueOrThrow({
      where: { tenantId_itemId_warehouseId: { tenantId: TENANT_A, itemId: WATER, warehouseId: MAIN } },
    });
    expect(Number(stockAfterReturn.quantity)).toBe(10);
    expect(Number(stockAfterReturn.averageCost)).toBe(3.2);

    const returnMv = await prisma.inventoryMovement.findFirstOrThrow({
      where: { tenantId: TENANT_A, originType: 'sales_return', originId: returnDoc.id },
    });
    expect(returnMv.direction).toBe('in');
    expect(Number(returnMv.quantity)).toBe(2);
    expect(Number(returnMv.unitCost)).toBe(2);
    expect(returnMv.restoresMovementId).toBe(dispatchMovements[0].id);
  });
});
