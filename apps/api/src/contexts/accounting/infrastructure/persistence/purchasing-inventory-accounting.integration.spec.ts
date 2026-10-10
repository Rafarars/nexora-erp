import { ConfigService } from '@nestjs/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PrismaPurchasingPortsHarness } from '../../../purchasing/infrastructure/testing/prisma-purchasing-ports.harness.js';
import { PrismaPayablesPortsHarness } from '../../../payables/infrastructure/testing/prisma-payables-ports.harness.js';
import { PrismaInventoryPortsHarness } from '../../../inventory/infrastructure/testing/prisma-inventory-ports.harness.js';
import { MAIN, PIECE, TENANT_A, WATER } from '../../../purchasing/domain/testing/purchasing.mother.js';
import { GoodsReceipt, GoodsReceiptId } from '../../../purchasing/domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptLine, GoodsReceiptLineId } from '../../../purchasing/domain/receipt/goods-receipt-line.js';
import { ReceiptConfirmation } from '../../../purchasing/domain/receipt/posting/receipt-confirmation.js';
import { ReceiptCancellation } from '../../../purchasing/domain/receipt/posting/receipt-cancellation.js';
import { PurchaseInvoiceId } from '../../../purchasing/domain/invoice/purchase-invoice-id.vo.js';
import { Supplier, SupplierId } from '../../../purchasing/domain/supplier/supplier.entity.js';
import { PurchaseOrder, PurchaseOrderId } from '../../../purchasing/domain/order/purchase-order.entity.js';
import { PurchaseOrderLine, PurchaseOrderLineId } from '../../../purchasing/domain/order/purchase-order-line.js';
import { WarehouseRef, ItemRef, UnitRef } from '../../../purchasing/domain/shared/references.vo.js';
import { Quantity } from '../../../purchasing/domain/shared/quantity.vo.js';
import { UnitCost, TaxRate } from '../../../purchasing/domain/shared/money.js';
import { AdjustmentId } from '../../../inventory/domain/adjustment/adjustment.entity.js';
import { AdjustmentLine, AdjustmentLineId } from '../../../inventory/domain/adjustment/adjustment-line.js';
import { Quantity as InvQuantity } from '../../../inventory/domain/quantity/quantity.vo.js';
import { UnitCost as InvUnitCost } from '../../../inventory/domain/quantity/unit-cost.vo.js';
import { AdjustmentDate } from '../../../inventory/domain/adjustment/adjustment-date.vo.js';
import { Adjustment } from '../../../inventory/domain/adjustment/adjustment.entity.js';
import { PurchaseInvoice } from '../../../purchasing/domain/invoice/purchase-invoice.entity.js';
import { SupplierInvoiceNumber } from '../../../purchasing/domain/invoice/supplier-invoice-number.vo.js';
import { PurchaseDate } from '../../../purchasing/domain/shared/purchase-date.vo.js';
import { PurchaseInvoiceLine } from '../../../purchasing/domain/invoice/purchase-invoice-line.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  return url;
}

describe('Purchasing, Payables & Inventory Accounting Integration', () => {
  const purchasingHarness = new PrismaPurchasingPortsHarness();
  const payablesHarness = new PrismaPayablesPortsHarness();
  const inventoryHarness = new PrismaInventoryPortsHarness();
  const prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  const tenant = TenantId.of(TENANT_A);

  beforeEach(async () => {
    await purchasingHarness.reset();
    await inventoryHarness.reset();
  });

  afterAll(async () => {
    await purchasingHarness.reset();
    await payablesHarness.close();
    await inventoryHarness.close();
    await prisma.$disconnect();
  });

  async function getCompanyAccounts(tenantId: string) {
    const s = await prisma.companySettings.findUniqueOrThrow({ where: { tenantId } });
    return {
      inventoryAccountId: s.inventoryAccountId!,
      unbilledGoodsAccountId: s.unbilledGoodsAccountId!,
      pendingPriceDifferenceAccountId: s.pendingPriceDifferenceAccountId!,
      priceDifferenceAccountId: s.priceDifferenceAccountId!,
      purchaseExpenseAccountId: s.purchaseExpenseAccountId!,
      taxPayableAccountId: s.taxPayableAccountId!,
      payablesAccountId: s.payablesAccountId!,
      cashAccountId: s.cashAccountId!,
      unappliedSupplierCreditNotesAccountId: s.unappliedSupplierCreditNotesAccountId!,
      inventoryAdjustmentAccountId: s.inventoryAdjustmentAccountId!,
    };
  }

  function aSupplier(id: string, code = 'PRV0001', name = 'Proveedor Test'): Supplier {
    return Supplier.create(
      SupplierId.of(id),
      tenant,
      code,
      {
        name,
        fiscalId: 'J-12345678-0',
        paymentTermDays: 30,
      },
      new Date('2026-10-10'),
    );
  }

  it('generates journal entry on goods receipt (§3.1) and reverses on cancellation (§3.12)', async () => {
    const ports = purchasingHarness.ports();
    const accounts = await getCompanyAccounts(tenant.value);

    const supplierId = '00000000-0000-4000-8000-000000000001';
    const supplier = aSupplier(supplierId);
    await ports.suppliers.save(supplier);

    const orderId = PurchaseOrderId.of('00000000-0000-4000-8000-000000000010');
    const orderLineId = PurchaseOrderLineId.of('00000000-0000-4000-8000-000000000011');
    const order = PurchaseOrder.draft(
      orderId,
      tenant,
      'OC000001',
      {
        supplierId: supplier.id,
        warehouseId: WarehouseRef.of(MAIN),
        orderDate: PurchaseDate.of('2026-10-10'),
        expectedDate: null,
        notes: null,
        paymentTermDays: 30,
        currency: DocumentCurrency.of({ currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualRate: false }),
        lines: [
          PurchaseOrderLine.of({
            id: orderLineId,
            lineNumber: 1,
            itemId: ItemRef.of(WATER),
            itemSku: 'CONTRATO-AGUA',
            itemName: 'Contrato agua',
            unitId: UnitRef.of(PIECE),
            quantity: Quantity.of(10),
            baseQuantity: Quantity.of(10),
            unitCost: UnitCost.of(15),
            taxRate: TaxRate.of(16),
            movesStock: true,
          }),
        ],
      },
      new Date('2026-10-10'),
      '2026-10-10',
    );
    await ports.orders.save(order);
    await ports.orderPosting.post(tenant, orderId, (o) => o.confirm(new Date('2026-10-10')));

    const receiptId = GoodsReceiptId.of('00000000-0000-4000-8000-000000000020');
    const receiptLineId = GoodsReceiptLineId.of('00000000-0000-4000-8000-000000000021');
    const receipt = GoodsReceipt.draft(
      receiptId,
      tenant,
      'ENT000001',
      { id: order.id, warehouseId: order.warehouseId(), date: order.orderDate() },
      {
        date: PurchaseDate.of('2026-10-10'),
        notes: null,
        currency: DocumentCurrency.of({ currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualRate: false }),
        lines: [
          GoodsReceiptLine.of({
            id: receiptLineId,
            lineNumber: 1,
            orderLineId,
            itemId: ItemRef.of(WATER),
            itemSku: 'CONTRATO-AGUA',
            itemName: 'Contrato agua',
            unitId: UnitRef.of(PIECE),
            quantity: Quantity.of(10),
            baseQuantity: Quantity.of(10),
            unitCost: UnitCost.of(15),
          }),
        ],
      },
      new Date('2026-10-10'),
      '2026-10-10',
    );
    await ports.receipts.save(receipt);

    // Confirm receipt -> Debe inventario 150, Haber mercancía por facturar 150
    await ports.receiptPosting.post(tenant, receipt.id, (r, o) => new ReceiptConfirmation().apply(r, o, new Date('2026-10-10')));

    const entry = await prisma.journalEntry.findFirst({
      where: { tenantId: tenant.value, originType: 'goods_receipt', originId: receiptId.value },
      include: { lines: true },
    });
    expect(entry).not.toBeNull();
    expect(entry!.description).toContain('Entrada');
    expect(entry!.lines).toHaveLength(2);

    const invLine = entry!.lines.find((l) => l.accountId === accounts.inventoryAccountId);
    const unbilledLine = entry!.lines.find((l) => l.accountId === accounts.unbilledGoodsAccountId);
    expect(Number(invLine?.debit)).toBe(150);
    expect(Number(unbilledLine?.credit)).toBe(150);

    // Cancel receipt -> Revert
    await ports.receiptPosting.post(tenant, receiptId, (r, o) => new ReceiptCancellation().apply(r, o, new Date('2026-10-10')));

    const reversal = await prisma.journalEntry.findFirst({
      where: { tenantId: tenant.value, reversalOfId: entry!.id },
      include: { lines: true },
    });
    expect(reversal).not.toBeNull();
    const revInvLine = reversal!.lines.find((l) => l.accountId === accounts.inventoryAccountId);
    const revUnbilledLine = reversal!.lines.find((l) => l.accountId === accounts.unbilledGoodsAccountId);
    expect(Number(revInvLine?.credit)).toBe(150);
    expect(Number(revUnbilledLine?.debit)).toBe(150);
  });

  it('generates journal entry on purchase invoice confirmation (§3.4) and physical adjustment (§3.11)', async () => {
    const ports = purchasingHarness.ports();
    const accounts = await getCompanyAccounts(tenant.value);

    const supplierId = '00000000-0000-4000-8000-000000000002';
    const supplier = aSupplier(supplierId, 'PRV0002', 'Proveedor Directo');
    await ports.suppliers.save(supplier);

    const invoiceId = '00000000-0000-4000-8000-000000000030';
    const invoice = PurchaseInvoice.draft(
      PurchaseInvoiceId.of(invoiceId),
      tenant,
      'FCP000001',
      {
        supplierId: supplier.id,
        supplierInvoiceNumber: SupplierInvoiceNumber.of('FAC-1234'),
        supplierInvoiceSeries: null,
        issueDate: PurchaseDate.of('2026-10-10'),
        dueDate: PurchaseDate.of('2026-10-25'),
        notes: null,
        currency: DocumentCurrency.of({ currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, baseExchangeRate: 1, manualRate: false }),
        lines: [
          PurchaseInvoiceLine.of({
            id: '00000000-0000-4000-8000-000000000031',
            lineNumber: 1,
            receiptLineId: null,
            orderLineId: null,
            itemId: null,
            itemSku: null,
            itemName: 'Honorarios Profesionales',
            concept: 'Servicio Contable',
            unitId: null,
            quantity: 1,
            unitPrice: 200,
            taxRate: 16,
          }),
        ],
      },
      new Date('2026-10-10'),
      '2026-10-10',
    );

    await ports.invoices.save(invoice);
    await ports.invoicePosting.confirm(tenant, invoice.id, new Date('2026-10-10'), '2026-10-10');

    const entry = await prisma.journalEntry.findFirst({
      where: { tenantId: tenant.value, originType: 'purchase_invoice', originId: invoiceId },
      include: { lines: true },
    });
    expect(entry).not.toBeNull();
    // Subtotal 200 a gasto de compras, impuesto 32 a impuesto por pagar, total 232 a proveedores por pagar
    const expenseLine = entry!.lines.find((l) => l.accountId === accounts.purchaseExpenseAccountId);
    const taxLine = entry!.lines.find((l) => l.accountId === accounts.taxPayableAccountId);
    const payablesLine = entry!.lines.find((l) => l.accountId === accounts.payablesAccountId);

    expect(Number(expenseLine?.debit)).toBe(200);
    expect(Number(taxLine?.debit)).toBe(32);
    expect(Number(payablesLine?.credit)).toBe(232);

    // Ajuste físico manual de inventario (§3.11)
    const invPorts = inventoryHarness.ports();
    const adjustmentId = '00000000-0000-4000-8000-000000000040';
    const lineId = '00000000-0000-4000-8000-000000000041';
    const adj = Adjustment.draft(
      AdjustmentId.of(adjustmentId),
      tenant,
      'AJU000001',
      {
        warehouseId: WarehouseRef.of(MAIN),
        date: AdjustmentDate.of('2026-10-10'),
        type: 'physical_count',
        notes: 'Conteo físico',
        lines: [
          AdjustmentLine.of({
            id: AdjustmentLineId.of(lineId),
            lineNumber: 1,
            itemId: ItemRef.of(WATER),
            itemSku: 'CONTRATO-AGUA',
            itemName: 'Contrato agua',
            unitId: UnitRef.of(PIECE),
            direction: 'in',
            quantity: InvQuantity.of(5),
            baseQuantity: InvQuantity.of(5),
            unitCost: InvUnitCost.of(10),
          }),
        ],
      },
      new Date('2026-10-10'),
      '2026-10-10',
    );

    await invPorts.adjustments.save(adj);
    await invPorts.posting.post(tenant, adj.id, (a, ledger) => {
      a.confirm(new Date('2026-10-10'), '99999999-9999-4999-8999-999999999999');
      return {
        adjustment: a,
        stocks: [],
        movements: [
          {
            toPrimitives: () => ({
              id: '00000000-0000-4000-8000-000000000088',
              tenantId: tenant.value,
              itemId: WATER,
              warehouseId: MAIN,
              sequence: 1,
              direction: 'in' as const,
              quantity: 5,
              unitCost: 10,
              balanceQuantity: 5,
              balanceAverageCost: 10,
              originType: 'adjustment' as const,
              originId: adjustmentId,
              originLineId: lineId,
              originDate: '2026-10-10',
              reversalOfId: null,
              restoresMovementId: null,
              occurredAt: new Date('2026-10-10'),
            }),
          } as any,
        ],
      };
    });

    const adjEntry = await prisma.journalEntry.findFirst({
      where: { tenantId: tenant.value, originType: 'inventory_adjustment', originId: adjustmentId },
      include: { lines: true },
    });
    expect(adjEntry).not.toBeNull();
    const adjInvLine = adjEntry!.lines.find((l) => l.accountId === accounts.inventoryAccountId);
    const adjContraLine = adjEntry!.lines.find((l) => l.accountId === accounts.inventoryAdjustmentAccountId);
    expect(Number(adjInvLine?.debit)).toBe(50);
    expect(Number(adjContraLine?.credit)).toBe(50);
  });
});
