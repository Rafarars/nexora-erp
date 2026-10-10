import { describe, expect, it } from 'vitest';
import { CompanyAccountConfig } from '../determination/account-resolver.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { EntryBuilder } from './entry-builder.js';

describe('EntryBuilder (§3 constructores puros por operación)', () => {
  const tenantId = TenantId.of('11111111-1111-4111-8111-111111111111');
  const base = {
    id: 'entry-001',
    tenantId,
    code: 'AST-000001',
    entryDate: new Date('2026-10-10'),
    currency: 'USD',
  };

  const company: CompanyAccountConfig = {
    inventoryAccountId: 'acc-inv',
    cogsAccountId: 'acc-cogs',
    salesRevenueAccountId: 'acc-sales',
    taxPayableAccountId: 'acc-tax',
    receivablesAccountId: 'acc-receivables',
    payablesAccountId: 'acc-payables',
    cashAccountId: 'acc-cash',
    inventoryAdjustmentAccountId: 'acc-adjustment',
    unappliedCreditNotesAccountId: 'acc-unapplied-cn',
    unappliedSupplierCreditNotesAccountId: 'acc-unapplied-scn',
    unbilledGoodsAccountId: 'acc-unbilled-goods',
    priceDifferenceAccountId: 'acc-price-diff',
    purchaseExpenseAccountId: 'acc-purchase-expense',
    pendingPriceDifferenceAccountId: 'acc-pending-price-diff',
    exchangeDifferenceAccountId: 'acc-exchange-diff',
    openingEquityAccountId: 'acc-opening-equity',
  };

  it('§3.1 Goods Received: Debe Inventario, Haber Mercancía por facturar', () => {
    const entry = EntryBuilder.goodsReceived(
      {
        ...base,
        receiptId: 'rec-01',
        lines: [{ amount: 500, label: 'Línea 1' }, { amount: 300, label: 'Línea 2' }],
      },
      company,
    );

    expect(entry.totalDebit()).toBe(800);
    expect(entry.totalCredit()).toBe(800);
    expect(entry.lines).toHaveLength(3);
    expect(entry.lines[0].accountId).toBe('acc-inv');
    expect(entry.lines[1].accountId).toBe('acc-inv');
    expect(entry.lines[2].accountId).toBe('acc-unbilled-goods');
    expect(entry.lines[2].credit).toBe(800);
  });

  it('§3.2 Goods Dispatched: Debe Costo de ventas, Haber Inventario', () => {
    const entry = EntryBuilder.goodsDispatched(
      {
        ...base,
        dispatchId: 'disp-01',
        lines: [{ amount: 450, label: 'Despacho de stock' }],
      },
      company,
    );

    expect(entry.totalDebit()).toBe(450);
    expect(entry.totalCredit()).toBe(450);
    expect(entry.lines[0].accountId).toBe('acc-cogs');
    expect(entry.lines[1].accountId).toBe('acc-inv');
  });

  it('§3.3 Sales Invoice Issued: Debe Clientes por cobrar, Haber Ventas, Haber IVA', () => {
    const entry = EntryBuilder.salesInvoiceIssued(
      {
        ...base,
        invoiceId: 'inv-01',
        lines: [{ subtotal: 1000, label: 'Mercancía' }],
        tax: 160,
        total: 1160,
      },
      company,
    );

    expect(entry.totalDebit()).toBe(1160);
    expect(entry.totalCredit()).toBe(1160);
    expect(entry.lines[0].accountId).toBe('acc-receivables');
    expect(entry.lines[1].accountId).toBe('acc-sales');
    expect(entry.lines[2].accountId).toBe('acc-tax');
  });

  it('§3.4 Purchase Invoice Confirmed: liquida mercancía por facturar y asienta diferencias', () => {
    const entry = EntryBuilder.purchaseInvoiceConfirmed(
      {
        ...base,
        invoiceId: 'fcp-01',
        baseCost: 1000,
        priceDifference: 100,
        exchangeDifference: 20,
        serviceLines: [{ amount: 50, label: 'Flete' }],
        tax: 187.2,
        total: 1357.2,
      },
      company,
    );

    expect(entry.totalDebit()).toBe(1357.2);
    expect(entry.totalCredit()).toBe(1357.2);
    expect(entry.lines.find((l) => l.accountId === 'acc-unbilled-goods')?.debit).toBe(1000);
    expect(entry.lines.find((l) => l.accountId === 'acc-pending-price-diff')?.debit).toBe(100);
    expect(entry.lines.find((l) => l.accountId === 'acc-exchange-diff')?.debit).toBe(20);
    expect(entry.lines.find((l) => l.accountId === 'acc-purchase-expense')?.debit).toBe(50);
    expect(entry.lines.find((l) => l.accountId === 'acc-tax')?.debit).toBe(187.2);
    expect(entry.lines.find((l) => l.accountId === 'acc-payables')?.credit).toBe(1357.2);
  });

  it('§3.5 Payment Received (dinero): Debe Caja/Banco, Haber Clientes por cobrar', () => {
    const entry = EntryBuilder.paymentReceived(
      {
        ...base,
        paymentId: 'cob-01',
        amountPaid: 500,
        allocatedAmount: 480,
        exchangeDifference: -20, // Pérdida en cambio o ajuste a crédito
      },
      company,
    );

    expect(entry.totalDebit()).toBe(500);
    expect(entry.totalCredit()).toBe(500);
    expect(entry.lines.find((l) => l.accountId === 'acc-cash')?.debit).toBe(500);
    expect(entry.lines.find((l) => l.accountId === 'acc-receivables')?.credit).toBe(480);
    expect(entry.lines.find((l) => l.accountId === 'acc-exchange-diff')?.credit).toBe(20);
  });

  it('§3.6 Payment Received Without Money (NCC aplicada): Debe Notas de crédito por aplicar, Haber Clientes', () => {
    const entry = EntryBuilder.paymentReceivedWithoutMoney(
      {
        ...base,
        paymentId: 'cob-ncc-01',
        amount: 250,
      },
      company,
    );

    expect(entry.totalDebit()).toBe(250);
    expect(entry.totalCredit()).toBe(250);
    expect(entry.lines[0].accountId).toBe('acc-unapplied-cn');
    expect(entry.lines[1].accountId).toBe('acc-receivables');
  });

  it('§3.7 Customer Credit Note Issued: Debe Ventas e IVA, Haber Notas de crédito por aplicar', () => {
    const entry = EntryBuilder.customerCreditNoteIssued(
      {
        ...base,
        creditNoteId: 'ncc-01',
        lines: [{ subtotal: 200, label: 'Descuento' }],
        tax: 32,
        total: 232,
      },
      company,
    );

    expect(entry.totalDebit()).toBe(232);
    expect(entry.totalCredit()).toBe(232);
    expect(entry.lines[0].accountId).toBe('acc-sales');
    expect(entry.lines[1].accountId).toBe('acc-tax');
    expect(entry.lines[2].accountId).toBe('acc-unapplied-cn');
  });

  it('§3.8 Payment Made: Debe Proveedores por pagar, Haber Caja/Banco', () => {
    const entry = EntryBuilder.paymentMade(
      {
        ...base,
        paymentId: 'pag-01',
        amountPaid: 600,
        allocatedAmount: 600,
        exchangeDifference: 0,
      },
      company,
    );

    expect(entry.totalDebit()).toBe(600);
    expect(entry.totalCredit()).toBe(600);
    expect(entry.lines[0].accountId).toBe('acc-payables');
    expect(entry.lines[1].accountId).toBe('acc-cash');
  });

  it('§3.9 Supplier Credit Note Issued and Payment: cubre emisión y saldado de facturas', () => {
    const entry = EntryBuilder.supplierCreditNoteIssued(
      {
        ...base,
        creditNoteId: 'ncp-01',
        total: 116,
        tax: 16,
        creditsReturn: null,
        priceDiscount: 100,
        priceDifference: 0,
        exchangeDifference: 0,
        serviceLines: [],
      },
      company,
    );

    expect(entry.totalDebit()).toBe(116);
    expect(entry.totalCredit()).toBe(116);
    expect(entry.lines[0].accountId).toBe('acc-unapplied-scn');
    expect(entry.lines[1].accountId).toBe('acc-tax');
    expect(entry.lines[2].accountId).toBe('acc-pending-price-diff');

    const paymentEntry = EntryBuilder.supplierCreditNotePaymentWithoutMoney(
      {
        ...base,
        paymentId: 'pag-scn-01',
        amount: 116,
      },
      company,
    );

    expect(paymentEntry.totalDebit()).toBe(116);
    expect(paymentEntry.totalCredit()).toBe(116);
    expect(paymentEntry.lines[0].accountId).toBe('acc-payables');
    expect(paymentEntry.lines[1].accountId).toBe('acc-unapplied-scn');
  });

  it('§3.10 Goods Returned: cliente con origen, sin origen y proveedor', () => {
    // Cliente con origen
    const retCustomerWithOrigin = EntryBuilder.goodsReturned(
      {
        ...base,
        returnId: 'ret-c1',
        side: 'customer',
        lines: [{ amount: 150, hasOriginMovement: true, label: 'Línea reingresada' }],
      },
      company,
    );
    expect(retCustomerWithOrigin.totalDebit()).toBe(150);
    expect(retCustomerWithOrigin.totalCredit()).toBe(150);
    expect(retCustomerWithOrigin.lines[0].accountId).toBe('acc-inv');
    expect(retCustomerWithOrigin.lines[1].accountId).toBe('acc-cogs');

    // Cliente sin origen
    const retCustomerWithoutOrigin = EntryBuilder.goodsReturned(
      {
        ...base,
        returnId: 'ret-c2',
        side: 'customer',
        lines: [{ amount: 75, hasOriginMovement: false, label: 'Línea sin origen' }],
      },
      company,
    );
    expect(retCustomerWithoutOrigin.totalDebit()).toBe(75);
    expect(retCustomerWithoutOrigin.totalCredit()).toBe(75);
    expect(retCustomerWithoutOrigin.lines[0].accountId).toBe('acc-inv');
    expect(retCustomerWithoutOrigin.lines[1].accountId).toBe('acc-adjustment');

    // Proveedor
    const retSupplier = EntryBuilder.goodsReturned(
      {
        ...base,
        returnId: 'ret-s1',
        side: 'supplier',
        lines: [{ amount: 200, hasOriginMovement: true, label: 'Devolución a proveedor' }],
      },
      company,
    );
    expect(retSupplier.totalDebit()).toBe(200);
    expect(retSupplier.totalCredit()).toBe(200);
    expect(retSupplier.lines[0].accountId).toBe('acc-unbilled-goods');
    expect(retSupplier.lines[1].accountId).toBe('acc-inv');
  });

  it('§3.11 Stock Adjusted y Revaluación por importe', () => {
    // Ajuste positivo
    const adjIn = EntryBuilder.stockAdjusted(
      {
        ...base,
        adjustmentId: 'adj-01',
        direction: 'in',
        lines: [{ amount: 90, label: 'Sobrante' }],
      },
      company,
    );
    expect(adjIn.totalDebit()).toBe(90);
    expect(adjIn.totalCredit()).toBe(90);
    expect(adjIn.lines[0].accountId).toBe('acc-inv');
    expect(adjIn.lines[1].accountId).toBe('acc-adjustment');

    // Revaluación por importe (precio compra con stock y parte vendida)
    const reval = EntryBuilder.purchasePriceRevalued(
      {
        ...base,
        adjustmentId: 'reval-01',
        lines: [{ stockPart: 40, soldPart: 60, label: 'Reparto de diferencia' }],
      },
      company,
    );
    expect(reval.totalDebit()).toBe(100);
    expect(reval.totalCredit()).toBe(100);
    expect(reval.lines[0].accountId).toBe('acc-inv');
    expect(reval.lines[0].debit).toBe(40);
    expect(reval.lines[1].accountId).toBe('acc-price-diff');
    expect(reval.lines[1].debit).toBe(60);
    expect(reval.lines[2].accountId).toBe('acc-pending-price-diff');
    expect(reval.lines[2].credit).toBe(100);
  });

  it('§3.13 Opening Balance: equilibra saldos iniciales contra Patrimonio de apertura', () => {
    const opening = EntryBuilder.openingBalance(
      {
        ...base,
        documentId: 'open-01',
        inventoryTotal: 5000,
        receivablesTotal: 3000,
        payablesTotal: 2000,
        equityTotal: 6000, // 5000 + 3000 - 2000 = 6000
      },
      company,
    );

    expect(opening.totalDebit()).toBe(8000);
    expect(opening.totalCredit()).toBe(8000);
    expect(opening.lines.find((l) => l.accountId === 'acc-inv')?.debit).toBe(5000);
    expect(opening.lines.find((l) => l.accountId === 'acc-receivables')?.debit).toBe(3000);
    expect(opening.lines.find((l) => l.accountId === 'acc-payables')?.credit).toBe(2000);
    expect(opening.lines.find((l) => l.accountId === 'acc-opening-equity')?.credit).toBe(6000);
  });
});
