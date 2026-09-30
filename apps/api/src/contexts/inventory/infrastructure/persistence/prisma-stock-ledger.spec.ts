import { describe, expect, it, vi } from 'vitest';
import { lockedLedger } from './prisma-stock-ledger.js';

describe('lockedLedger (1.2)', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const itemId = '22222222-2222-4222-8222-222222222222';
  const warehouseId = '33333333-3333-4333-8333-333333333333';
  const sourceMovementId = '44444444-4444-4444-8444-444444444444';

  function createMockTx() {
    return {
      item: {
        findMany: vi.fn(async () => [
          {
            id: itemId,
            isActive: true,
            type: 'inventory',
            conversionFactors: [],
          },
        ]),
      },
      itemUnit: {
        findMany: vi.fn(async () => []),
      },
      $executeRaw: vi.fn(async () => 1),
      $queryRaw: vi.fn(async () => [{ id: itemId }]),
      itemStock: {
        findMany: vi.fn(async () => [
          {
            quantity: 10,
            averageCost: 5,
          },
        ]),
        findUniqueOrThrow: vi.fn(async () => ({
          tenantId,
          itemId,
          warehouseId,
          quantity: 10,
          averageCost: 5,
          lastSequence: 1,
          updatedAt: new Date('2026-10-01T00:00:00.000Z'),
        })),
      },
      inventoryMovement: {
        findFirst: vi.fn(async () => ({ sequence: 10 })),
        findMany: vi.fn(async () => []),
      },
    };
  }

  it('no consulta inventory_movements si no hay lineas de revaluacion por importe (1.2)', async () => {
    const tx = createMockTx();

    await lockedLedger(tx as any, tenantId, [[itemId, warehouseId]], [], []);

    expect(tx.inventoryMovement.findFirst).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.findMany).not.toHaveBeenCalled();
  });

  it('consulta inventory_movements unicamente para las lineas con revaluacion por importe', async () => {
    const tx = createMockTx();

    await lockedLedger(
      tx as any,
      tenantId,
      [[itemId, warehouseId]],
      [],
      [{ itemId, warehouseId, sourceMovementId }],
    );

    expect(tx.inventoryMovement.findFirst).toHaveBeenCalledWith({
      where: { tenantId, id: sourceMovementId },
      select: { sequence: true },
    });
    expect(tx.inventoryMovement.findMany).toHaveBeenCalledWith({
      where: {
        tenantId,
        itemId,
        warehouseId,
        sequence: { gt: 10 },
      },
      orderBy: { sequence: 'asc' },
    });
  });
});
