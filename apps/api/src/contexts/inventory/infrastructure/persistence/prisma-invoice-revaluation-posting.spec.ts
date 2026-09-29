import { describe, expect, it, vi } from 'vitest';
import { PrismaInvoiceRevaluationPosting } from './prisma-invoice-revaluation-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { InventoryCodeSequence } from '../../domain/shared/code-sequence.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';

describe('PrismaInvoiceRevaluationPosting (H9 Defectos 1.3 y 1.4)', () => {
  const tenantId = TenantId.of('11111111-1111-4111-8111-111111111111');
  const invoiceId = '22222222-2222-4222-8222-222222222222';
  const warehouseId = '33333333-3333-4333-8333-333333333333';
  const itemId = '44444444-4444-4444-8444-444444444444';
  const unitId = '55555555-5555-4555-8555-555555555555';
  const userId = 'user-confirmador-1';

  it('crea el ajuste con la fecha de la factura y autor, sin fallar a las 20:30 de Caracas (00:30 UTC de manana)', async () => {
    // A las 20:30 de Caracas del 1 de octubre, en UTC ya es 2 de octubre a las 00:30
    const nowUtcAtNight = new Date('2026-10-02T00:30:00.000Z');
    const invoiceDate = '2026-10-01';
    const todayInCompany = '2026-10-01'; // Hoy en Caracas sigue siendo 1 de octubre

    let createdAdjustment: any = null;
    let createdLines: any[] = [];

    const mockPrismaClient = {
      adjustment: {
        create: vi.fn(async ({ data }) => {
          createdAdjustment = data;
          return data;
        }),
      },
      adjustmentLine: {
        createMany: vi.fn(async ({ data }) => {
          createdLines = data;
          return { count: data.length };
        }),
      },
    };

    const mockCodes: InventoryCodeSequence = {
      next: vi.fn(async () => 5),
    };

    const posting = new PrismaInvoiceRevaluationPosting(
      mockPrismaClient as unknown as PrismaService,
      mockCodes,
    );

    await posting.createDraftRevaluations(
      tenantId,
      invoiceId,
      'FCP000001',
      invoiceDate,
      [
        {
          warehouseId,
          lines: [
            {
              lineNumber: 1,
              itemId,
              itemSku: 'AGUA-500',
              itemName: 'Agua mineral 500 ml',
              unitId,
              amount: 50,
              sourceMovementId: 'mov-1',
              reason: 'price_difference',
            },
          ],
        },
      ],
      nowUtcAtNight,
      todayInCompany,
      userId,
      mockPrismaClient,
    );

    expect(createdAdjustment).not.toBeNull();
    // 1.3: Usa la secuencia oficial AJU y registra el usuario autor
    expect(mockCodes.next).toHaveBeenCalledWith(tenantId, 'AJU');
    expect(createdAdjustment?.code).toBe('AJU000005');
    expect(createdAdjustment?.createdBy).toBe(userId);
    expect(createdAdjustment?.originType).toBe('purchase_invoice');
    expect(createdAdjustment?.originId).toBe(invoiceId);

    // 1.4: Lleva la fecha de la factura (2026-10-01T00:00:00Z), NUNCA la fecha UTC de manana
    expect(createdAdjustment?.adjustmentDate).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(createdLines).toHaveLength(1);
    expect(createdLines[0].amount).toBe(50);
  });

  it('al anular una factura con revaluacion confirmada a las 20:30, crea el reverso con la fecha de hoy de la empresa', async () => {
    const nowUtcAtNight = new Date('2026-10-02T00:30:00.000Z');
    const todayInCompany = '2026-10-01';
    const cancellerUserId = 'user-anulador-1';

    let createdAdjustment: any = null;
    let createdLines: any[] = [];

    const mockPrismaClient = {
      adjustment: {
        findMany: vi.fn(async () => [
          {
            id: 'adj-confirmed-1',
            tenantId: tenantId.value,
            code: 'AJU000001',
            warehouseId,
            status: 'confirmed',
            lines: [
              {
                id: 'line-1',
                lineNumber: 1,
                itemId,
                itemSku: 'AGUA-500',
                itemName: 'Agua mineral 500 ml',
                unitId,
                amount: 50,
                sourceMovementId: 'mov-1',
              },
            ],
          },
        ]),
        create: vi.fn(async ({ data }) => {
          createdAdjustment = data;
          return data;
        }),
      },
      adjustmentLine: {
        createMany: vi.fn(async ({ data }) => {
          createdLines = data;
          return { count: data.length };
        }),
      },
    };

    const mockCodes: InventoryCodeSequence = {
      next: vi.fn(async () => 6),
    };

    const posting = new PrismaInvoiceRevaluationPosting(
      mockPrismaClient as unknown as PrismaService,
      mockCodes,
    );

    await posting.cancelOrReverseRevaluations(
      tenantId,
      invoiceId,
      'FCP000001',
      nowUtcAtNight,
      todayInCompany,
      cancellerUserId,
      mockPrismaClient,
    );

    expect(createdAdjustment).not.toBeNull();
    expect(mockCodes.next).toHaveBeenCalledWith(tenantId, 'AJU');
    expect(createdAdjustment?.code).toBe('AJU000006');
    expect(createdAdjustment?.createdBy).toBe(cancellerUserId);
    // El ajuste inverso lleva la fecha de hoy en Caracas (2026-10-01), no la fecha futura de manana en UTC
    expect(createdAdjustment?.adjustmentDate).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(createdLines).toHaveLength(1);
    expect(createdLines[0].amount).toBe(-50);
  });
});
