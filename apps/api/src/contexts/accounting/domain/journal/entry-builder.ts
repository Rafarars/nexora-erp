import { amountUnits, roundRatio, unitsToNumber } from '../../../../shared/domain/amount.js';
import {
  AccountResolver,
  CompanyAccountConfig,
  OperationalLineAccountContext,
} from '../determination/account-resolver.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { JournalEntryLine } from './journal-entry-line.entity.js';
import { JournalEntry } from './journal-entry.entity.js';

export interface EntryBaseParams {
  id: string;
  tenantId: TenantId;
  code: string;
  entryDate: Date;
  currency: string;
}

export class EntryBuilder {
  /**
   * §3.1 Confirmar una entrada de mercancía:
   * Debe: Inventario (por línea / artículo)
   * Haber: Mercancía por facturar (total)
   */
  static goodsReceived(
    params: EntryBaseParams & {
      receiptId: string;
      lines: {
        context?: OperationalLineAccountContext;
        amount: number;
        label: string;
      }[];
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const unbilledGoodsAccount = AccountResolver.resolveCompany('unbilledGoods', company);
    const entryLines: JournalEntryLine[] = [];
    let totalUnits = 0n;
    let lineIdx = 1;

    for (const l of params.lines) {
      if (l.amount <= 0) continue;
      const invAccount = AccountResolver.resolveOperational('inventory', l.context, company);
      entryLines.push(
        JournalEntryLine.debit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: invAccount,
          amount: l.amount,
          label: l.label,
        }),
      );
      totalUnits += amountUnits(l.amount);
    }

    entryLines.push(
      JournalEntryLine.credit({
        id: `${params.id}-l${lineIdx}`,
        accountId: unbilledGoodsAccount,
        amount: unitsToNumber(totalUnits),
        label: 'Mercancía por facturar',
      }),
    );

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: 'goods_receipt',
      originId: params.receiptId,
      description: 'Entrada de mercancía a almacén',
      currency: params.currency,
      lines: entryLines,
    });
  }

  /**
   * §3.2 Confirmar un despacho:
   * Debe: Costo de ventas
   * Haber: Inventario
   */
  static goodsDispatched(
    params: EntryBaseParams & {
      dispatchId: string;
      lines: {
        context?: OperationalLineAccountContext;
        amount: number;
        label: string;
      }[];
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const entryLines: JournalEntryLine[] = [];
    let lineIdx = 1;

    for (const l of params.lines) {
      if (l.amount <= 0) continue;
      const cogsAccount = AccountResolver.resolveOperational('cogs', l.context, company);
      const invAccount = AccountResolver.resolveOperational('inventory', l.context, company);

      entryLines.push(
        JournalEntryLine.debit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: cogsAccount,
          amount: l.amount,
          label: `Costo de ventas: ${l.label}`,
        }),
      );
      entryLines.push(
        JournalEntryLine.credit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: invAccount,
          amount: l.amount,
          label: `Inventario: ${l.label}`,
        }),
      );
    }

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: 'dispatch',
      originId: params.dispatchId,
      description: 'Costo de ventas por despacho de mercancía',
      currency: params.currency,
      lines: entryLines,
    });
  }

  /**
   * §3.3 Emitir una factura de venta:
   * Debe: Clientes por cobrar (Total)
   * Haber: Ingresos por ventas (Subtotal por línea)
   * Haber: Impuesto por pagar (Impuesto total)
   */
  static salesInvoiceIssued(
    params: EntryBaseParams & {
      invoiceId: string;
      lines: {
        context?: OperationalLineAccountContext;
        subtotal: number;
        label: string;
      }[];
      tax: number;
      total: number;
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const receivablesAccount = AccountResolver.resolveCompany('receivables', company);
    const taxPayableAccount = params.tax > 0 ? AccountResolver.resolveCompany('taxPayable', company) : null;
    const entryLines: JournalEntryLine[] = [];
    let lineIdx = 1;

    entryLines.push(
      JournalEntryLine.debit({
        id: `${params.id}-l${lineIdx++}`,
        accountId: receivablesAccount,
        amount: params.total,
        label: 'Clientes por cobrar',
      }),
    );

    for (const l of params.lines) {
      if (l.subtotal <= 0) continue;
      const revenueAccount = AccountResolver.resolveOperational('salesRevenue', l.context, company);
      entryLines.push(
        JournalEntryLine.credit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: revenueAccount,
          amount: l.subtotal,
          label: `Ingreso por venta: ${l.label}`,
        }),
      );
    }

    if (params.tax > 0 && taxPayableAccount) {
      entryLines.push(
        JournalEntryLine.credit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: taxPayableAccount,
          amount: params.tax,
          label: 'Impuesto por pagar',
        }),
      );
    }

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: 'sales_invoice',
      originId: params.invoiceId,
      description: 'Factura de venta emitida',
      currency: params.currency,
      lines: entryLines,
    });
  }

  /**
   * §3.4 Confirmar una factura de compra:
   * Debe: Mercancía por facturar (baseCost)
   * Debe o Haber: Diferencia de precio pendiente (priceDifference)
   * Debe o Haber: Diferencia en cambio (exchangeDifference)
   * Debe: Gasto de compras (serviceLines)
   * Debe: Impuesto por pagar (tax)
   * Haber: Proveedores por pagar (total)
   */
  static purchaseInvoiceConfirmed(
    params: EntryBaseParams & {
      invoiceId: string;
      baseCost: number;
      priceDifference: number;
      exchangeDifference: number;
      serviceLines: {
        context?: OperationalLineAccountContext;
        amount: number;
        label: string;
      }[];
      tax: number;
      total: number;
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const payablesAccount = AccountResolver.resolveCompany('payables', company);
    const entryLines: JournalEntryLine[] = [];
    let lineIdx = 1;

    if (params.baseCost > 0) {
      const unbilledGoodsAccount = AccountResolver.resolveCompany('unbilledGoods', company);
      entryLines.push(
        JournalEntryLine.debit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: unbilledGoodsAccount,
          amount: params.baseCost,
          label: 'Mercancía por facturar liquidada',
        }),
      );
    }

    if (params.priceDifference !== 0) {
      const pendingDiffAccount = AccountResolver.resolveCompany('pendingPriceDifference', company);
      if (params.priceDifference > 0) {
        entryLines.push(
          JournalEntryLine.debit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: pendingDiffAccount,
            amount: params.priceDifference,
            label: 'Diferencia de precio pendiente (mayor costo)',
          }),
        );
      } else {
        entryLines.push(
          JournalEntryLine.credit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: pendingDiffAccount,
            amount: Math.abs(params.priceDifference),
            label: 'Diferencia de precio pendiente (menor costo)',
          }),
        );
      }
    }

    if (params.exchangeDifference !== 0) {
      const exchangeDiffAccount = AccountResolver.resolveCompany('exchangeDifference', company);
      if (params.exchangeDifference > 0) {
        entryLines.push(
          JournalEntryLine.debit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: exchangeDiffAccount,
            amount: params.exchangeDifference,
            label: 'Diferencia en cambio',
          }),
        );
      } else {
        entryLines.push(
          JournalEntryLine.credit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: exchangeDiffAccount,
            amount: Math.abs(params.exchangeDifference),
            label: 'Diferencia en cambio',
          }),
        );
      }
    }

    for (const s of params.serviceLines) {
      if (s.amount <= 0) continue;
      const expenseAccount = AccountResolver.resolveOperational('purchaseExpense', s.context, company);
      entryLines.push(
        JournalEntryLine.debit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: expenseAccount,
          amount: s.amount,
          label: `Gasto de compras: ${s.label}`,
        }),
      );
    }

    if (params.tax > 0) {
      const taxAccount = AccountResolver.resolveCompany('taxPayable', company);
      entryLines.push(
        JournalEntryLine.debit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: taxAccount,
          amount: params.tax,
          label: 'Impuesto por pagar (crédito fiscal)',
        }),
      );
    }

    entryLines.push(
      JournalEntryLine.credit({
        id: `${params.id}-l${lineIdx++}`,
        accountId: payablesAccount,
        amount: params.total,
        label: 'Proveedores por pagar',
      }),
    );

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: 'purchase_invoice',
      originId: params.invoiceId,
      description: 'Factura de compra confirmada',
      currency: params.currency,
      lines: entryLines,
    });
  }

  /**
   * §3.5 Confirmar un cobro (con dinero):
   * Debe: Caja o banco
   * Debe o Haber: Diferencia en cambio
   * Haber: Clientes por cobrar
   */
  static paymentReceived(
    params: EntryBaseParams & {
      paymentId: string;
      amountPaid: number;
      allocatedAmount: number;
      exchangeDifference: number;
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const cashAccount = AccountResolver.resolveCompany('cash', company);
    const receivablesAccount = AccountResolver.resolveCompany('receivables', company);
    const entryLines: JournalEntryLine[] = [];
    let lineIdx = 1;

    entryLines.push(
      JournalEntryLine.debit({
        id: `${params.id}-l${lineIdx++}`,
        accountId: cashAccount,
        amount: params.amountPaid,
        label: 'Caja y banco (cobro recibido)',
      }),
    );

    if (params.exchangeDifference !== 0) {
      const exchangeDiffAccount = AccountResolver.resolveCompany('exchangeDifference', company);
      if (params.exchangeDifference > 0) {
        entryLines.push(
          JournalEntryLine.debit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: exchangeDiffAccount,
            amount: params.exchangeDifference,
            label: 'Diferencia en cambio',
          }),
        );
      } else {
        entryLines.push(
          JournalEntryLine.credit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: exchangeDiffAccount,
            amount: Math.abs(params.exchangeDifference),
            label: 'Diferencia en cambio',
          }),
        );
      }
    }

    entryLines.push(
      JournalEntryLine.credit({
        id: `${params.id}-l${lineIdx++}`,
        accountId: receivablesAccount,
        amount: params.allocatedAmount,
        label: 'Clientes por cobrar abonado',
      }),
    );

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: 'customer_payment',
      originId: params.paymentId,
      description: 'Cobro a cliente recibido',
      currency: params.currency,
      lines: entryLines,
    });
  }

  /**
   * §3.6 Confirmar un cobro sin dinero (de una nota de crédito a cliente):
   * Debe: Notas de crédito por aplicar
   * Haber: Clientes por cobrar
   */
  static paymentReceivedWithoutMoney(
    params: EntryBaseParams & {
      paymentId: string;
      amount: number;
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const unappliedCreditNotesAccount = AccountResolver.resolveCompany('unappliedCreditNotes', company);
    const receivablesAccount = AccountResolver.resolveCompany('receivables', company);

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: 'customer_payment_credit_note',
      originId: params.paymentId,
      description: 'Aplicación de nota de crédito a cliente',
      currency: params.currency,
      lines: [
        JournalEntryLine.debit({
          id: `${params.id}-l1`,
          accountId: unappliedCreditNotesAccount,
          amount: params.amount,
          label: 'Notas de crédito por aplicar',
        }),
        JournalEntryLine.credit({
          id: `${params.id}-l2`,
          accountId: receivablesAccount,
          amount: params.amount,
          label: 'Clientes por cobrar saldado',
        }),
      ],
    });
  }

  /**
   * §3.7 Emitir una nota de crédito a cliente:
   * Debe: Ingresos por ventas (subtotal por líneas)
   * Debe: Impuesto por pagar (impuesto)
   * Haber: Notas de crédito por aplicar (total)
   */
  static customerCreditNoteIssued(
    params: EntryBaseParams & {
      creditNoteId: string;
      lines: {
        context?: OperationalLineAccountContext;
        subtotal: number;
        label: string;
      }[];
      tax: number;
      total: number;
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const unappliedCreditNotesAccount = AccountResolver.resolveCompany('unappliedCreditNotes', company);
    const entryLines: JournalEntryLine[] = [];
    let lineIdx = 1;

    for (const l of params.lines) {
      if (l.subtotal <= 0) continue;
      const revenueAccount = AccountResolver.resolveOperational('salesRevenue', l.context, company);
      entryLines.push(
        JournalEntryLine.debit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: revenueAccount,
          amount: l.subtotal,
          label: `Reverso de ingresos: ${l.label}`,
        }),
      );
    }

    if (params.tax > 0) {
      const taxAccount = AccountResolver.resolveCompany('taxPayable', company);
      entryLines.push(
        JournalEntryLine.debit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: taxAccount,
          amount: params.tax,
          label: 'Impuesto por pagar (débito fiscal)',
        }),
      );
    }

    entryLines.push(
      JournalEntryLine.credit({
        id: `${params.id}-l${lineIdx++}`,
        accountId: unappliedCreditNotesAccount,
        amount: params.total,
        label: 'Notas de crédito por aplicar',
      }),
    );

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: 'customer_credit_note',
      originId: params.creditNoteId,
      description: 'Emisión de nota de crédito a cliente',
      currency: params.currency,
      lines: entryLines,
    });
  }

  /**
   * §3.8 Confirmar un pago a proveedor:
   * Debe: Proveedores por pagar
   * Debe o Haber: Diferencia en cambio
   * Haber: Caja o banco
   */
  static paymentMade(
    params: EntryBaseParams & {
      paymentId: string;
      amountPaid: number;
      allocatedAmount: number;
      exchangeDifference: number;
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const payablesAccount = AccountResolver.resolveCompany('payables', company);
    const cashAccount = AccountResolver.resolveCompany('cash', company);
    const entryLines: JournalEntryLine[] = [];
    let lineIdx = 1;

    entryLines.push(
      JournalEntryLine.debit({
        id: `${params.id}-l${lineIdx++}`,
        accountId: payablesAccount,
        amount: params.allocatedAmount,
        label: 'Proveedores por pagar cancelado',
      }),
    );

    if (params.exchangeDifference !== 0) {
      const exchangeDiffAccount = AccountResolver.resolveCompany('exchangeDifference', company);
      if (params.exchangeDifference > 0) {
        entryLines.push(
          JournalEntryLine.debit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: exchangeDiffAccount,
            amount: params.exchangeDifference,
            label: 'Diferencia en cambio',
          }),
        );
      } else {
        entryLines.push(
          JournalEntryLine.credit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: exchangeDiffAccount,
            amount: Math.abs(params.exchangeDifference),
            label: 'Diferencia en cambio',
          }),
        );
      }
    }

    entryLines.push(
      JournalEntryLine.credit({
        id: `${params.id}-l${lineIdx++}`,
        accountId: cashAccount,
        amount: params.amountPaid,
        label: 'Caja y banco (pago emitido)',
      }),
    );

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: 'supplier_payment',
      originId: params.paymentId,
      description: 'Pago a proveedor confirmado',
      currency: params.currency,
      lines: entryLines,
    });
  }

  /**
   * §3.9 Emitir una nota de crédito de proveedor:
   * Debe: Notas de crédito de proveedor por aplicar (Total)
   * Haber: Impuesto por pagar (Impuesto)
   * Haber: Mercancía por facturar (si acredita devolución)
   * Haber: Diferencia de precio pendiente (si rebaja precio)
   * Haber o Debe: Diferencia de precio de compra (desvío de devolución)
   * Debe o Haber: Diferencia en cambio
   * Haber: Gasto de compras (líneas de servicio)
   */
  static supplierCreditNoteIssued(
    params: EntryBaseParams & {
      creditNoteId: string;
      total: number;
      tax: number;
      creditsReturn: { returnedCost: number } | null;
      priceDiscount: number;
      priceDifference: number;
      exchangeDifference: number;
      serviceLines: {
        context?: OperationalLineAccountContext;
        amount: number;
        label: string;
      }[];
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const unappliedSupplierCreditNotesAccount = AccountResolver.resolveCompany('unappliedSupplierCreditNotes', company);
    const entryLines: JournalEntryLine[] = [];
    let lineIdx = 1;

    entryLines.push(
      JournalEntryLine.debit({
        id: `${params.id}-l${lineIdx++}`,
        accountId: unappliedSupplierCreditNotesAccount,
        amount: params.total,
        label: 'Notas de crédito de proveedor por aplicar',
      }),
    );

    if (params.tax > 0) {
      const taxAccount = AccountResolver.resolveCompany('taxPayable', company);
      entryLines.push(
        JournalEntryLine.credit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: taxAccount,
          amount: params.tax,
          label: 'Impuesto por pagar (reverso de crédito fiscal)',
        }),
      );
    }

    if (params.creditsReturn && params.creditsReturn.returnedCost > 0) {
      const unbilledGoodsAccount = AccountResolver.resolveCompany('unbilledGoods', company);
      entryLines.push(
        JournalEntryLine.credit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: unbilledGoodsAccount,
          amount: params.creditsReturn.returnedCost,
          label: 'Mercancía por facturar saldada por devolución',
        }),
      );
    }

    if (params.priceDiscount > 0) {
      const pendingPriceDiffAccount = AccountResolver.resolveCompany('pendingPriceDifference', company);
      entryLines.push(
        JournalEntryLine.credit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: pendingPriceDiffAccount,
          amount: params.priceDiscount,
          label: 'Diferencia de precio pendiente (rebaja de precio)',
        }),
      );
    }

    if (params.priceDifference !== 0) {
      const priceDiffAccount = AccountResolver.resolveCompany('priceDifference', company);
      if (params.priceDifference > 0) {
        entryLines.push(
          JournalEntryLine.credit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: priceDiffAccount,
            amount: params.priceDifference,
            label: 'Diferencia de precio de compra',
          }),
        );
      } else {
        entryLines.push(
          JournalEntryLine.debit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: priceDiffAccount,
            amount: Math.abs(params.priceDifference),
            label: 'Diferencia de precio de compra',
          }),
        );
      }
    }

    if (params.exchangeDifference !== 0) {
      const exchangeDiffAccount = AccountResolver.resolveCompany('exchangeDifference', company);
      if (params.exchangeDifference > 0) {
        entryLines.push(
          JournalEntryLine.debit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: exchangeDiffAccount,
            amount: params.exchangeDifference,
            label: 'Diferencia en cambio',
          }),
        );
      } else {
        entryLines.push(
          JournalEntryLine.credit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: exchangeDiffAccount,
            amount: Math.abs(params.exchangeDifference),
            label: 'Diferencia en cambio',
          }),
        );
      }
    }

    for (const s of params.serviceLines) {
      if (s.amount <= 0) continue;
      const expenseAccount = AccountResolver.resolveOperational('purchaseExpense', s.context, company);
      entryLines.push(
        JournalEntryLine.credit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: expenseAccount,
          amount: s.amount,
          label: `Gasto de compras rebajado: ${s.label}`,
        }),
      );
    }

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: 'supplier_credit_note',
      originId: params.creditNoteId,
      description: 'Emisión de nota de crédito de proveedor',
      currency: params.currency,
      lines: entryLines,
    });
  }

  /**
   * §3.9 Pago sin dinero de nota de crédito de proveedor:
   * Debe: Proveedores por pagar
   * Haber: Notas de crédito de proveedor por aplicar
   */
  static supplierCreditNotePaymentWithoutMoney(
    params: EntryBaseParams & {
      paymentId: string;
      amount: number;
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const payablesAccount = AccountResolver.resolveCompany('payables', company);
    const unappliedSupplierCreditNotesAccount = AccountResolver.resolveCompany('unappliedSupplierCreditNotes', company);

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: 'supplier_payment_credit_note',
      originId: params.paymentId,
      description: 'Aplicación de nota de crédito de proveedor a facturas',
      currency: params.currency,
      lines: [
        JournalEntryLine.debit({
          id: `${params.id}-l1`,
          accountId: payablesAccount,
          amount: params.amount,
          label: 'Proveedores por pagar saldado',
        }),
        JournalEntryLine.credit({
          id: `${params.id}-l2`,
          accountId: unappliedSupplierCreditNotesAccount,
          amount: params.amount,
          label: 'Notas de crédito de proveedor por aplicar',
        }),
      ],
    });
  }

  /**
   * §3.10 Confirmar una devolución de mercancía:
   * 1. De venta con origen: Debe Inventario, Haber Costo de ventas
   * 2. De venta sin origen: Debe Inventario, Haber Ajuste de inventario
   * 3. De compra: Debe Mercancía por facturar, Haber Inventario
   */
  static goodsReturned(
    params: EntryBaseParams & {
      returnId: string;
      side: 'customer' | 'supplier';
      lines: {
        context?: OperationalLineAccountContext;
        amount: number;
        hasOriginMovement: boolean;
        label: string;
      }[];
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const entryLines: JournalEntryLine[] = [];
    let lineIdx = 1;

    if (params.side === 'customer') {
      for (const l of params.lines) {
        if (l.amount <= 0) continue;
        const invAccount = AccountResolver.resolveOperational('inventory', l.context, company);
        const contraAccount = l.hasOriginMovement
          ? AccountResolver.resolveOperational('cogs', l.context, company)
          : AccountResolver.resolveCompany('inventoryAdjustment', company);

        entryLines.push(
          JournalEntryLine.debit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: invAccount,
            amount: l.amount,
            label: `Inventario devuelto: ${l.label}`,
          }),
        );
        entryLines.push(
          JournalEntryLine.credit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: contraAccount,
            amount: l.amount,
            label: l.hasOriginMovement ? `Reverso costo ventas: ${l.label}` : `Ajuste inventario: ${l.label}`,
          }),
        );
      }
    } else {
      // Devolución a proveedor
      const unbilledGoodsAccount = AccountResolver.resolveCompany('unbilledGoods', company);
      let totalUnits = 0n;

      for (const l of params.lines) {
        if (l.amount <= 0) continue;
        const invAccount = AccountResolver.resolveOperational('inventory', l.context, company);
        entryLines.push(
          JournalEntryLine.credit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: invAccount,
            amount: l.amount,
            label: `Salida de inventario devuelto: ${l.label}`,
          }),
        );
        totalUnits += amountUnits(l.amount);
      }

      entryLines.unshift(
        JournalEntryLine.debit({
          id: `${params.id}-l0`,
          accountId: unbilledGoodsAccount,
          amount: unitsToNumber(totalUnits),
          label: 'Mercancía por facturar (devolución a proveedor)',
        }),
      );
    }

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: params.side === 'customer' ? 'sales_return' : 'purchase_return',
      originId: params.returnId,
      description: params.side === 'customer' ? 'Devolución de cliente confirmada' : 'Devolución a proveedor confirmada',
      currency: params.currency,
      lines: entryLines,
    });
  }

  /**
   * §3.11 Confirmar un ajuste de inventario (manual o revaluación):
   */
  static stockAdjusted(
    params: EntryBaseParams & {
      adjustmentId: string;
      direction: 'in' | 'out';
      lines: {
        context?: OperationalLineAccountContext;
        amount: number;
        label: string;
      }[];
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const adjustmentAccount = AccountResolver.resolveCompany('inventoryAdjustment', company);
    const entryLines: JournalEntryLine[] = [];
    let lineIdx = 1;

    for (const l of params.lines) {
      if (l.amount <= 0) continue;
      const invAccount = AccountResolver.resolveOperational('inventory', l.context, company);

      if (params.direction === 'in') {
        entryLines.push(
          JournalEntryLine.debit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: invAccount,
            amount: l.amount,
            label: `Entrada por ajuste: ${l.label}`,
          }),
        );
        entryLines.push(
          JournalEntryLine.credit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: adjustmentAccount,
            amount: l.amount,
            label: `Ajuste de inventario (+): ${l.label}`,
          }),
        );
      } else {
        entryLines.push(
          JournalEntryLine.debit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: adjustmentAccount,
            amount: l.amount,
            label: `Ajuste de inventario (-): ${l.label}`,
          }),
        );
        entryLines.push(
          JournalEntryLine.credit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: invAccount,
            amount: l.amount,
            label: `Salida por ajuste: ${l.label}`,
          }),
        );
      }
    }

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: 'inventory_adjustment',
      originId: params.adjustmentId,
      description: 'Ajuste de inventario físico',
      currency: params.currency,
      lines: entryLines,
    });
  }

  /**
   * §3.11 Revaluación por importe (diferencia de precio de compra confirmada):
   * Reparte entre inventario (stockPart) y diferencia de precio de compra (soldPart)
   * contra diferencia de precio pendiente.
   */
  static purchasePriceRevalued(
    params: EntryBaseParams & {
      adjustmentId: string;
      lines: {
        context?: OperationalLineAccountContext;
        stockPart: number;
        soldPart: number;
        label: string;
      }[];
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const pendingDiffAccount = AccountResolver.resolveCompany('pendingPriceDifference', company);
    const priceDiffAccount = AccountResolver.resolveCompany('priceDifference', company);
    const entryLines: JournalEntryLine[] = [];
    let lineIdx = 1;

    for (const l of params.lines) {
      const invAccount = AccountResolver.resolveOperational('inventory', l.context, company);
      const totalDiff = unitsToNumber(amountUnits(l.stockPart) + amountUnits(l.soldPart));
      if (totalDiff === 0) continue;

      if (totalDiff > 0) {
        if (l.stockPart > 0) {
          entryLines.push(
            JournalEntryLine.debit({
              id: `${params.id}-l${lineIdx++}`,
              accountId: invAccount,
              amount: l.stockPart,
              label: `Revaluación stock en bodega: ${l.label}`,
            }),
          );
        }
        if (l.soldPart > 0) {
          entryLines.push(
            JournalEntryLine.debit({
              id: `${params.id}-l${lineIdx++}`,
              accountId: priceDiffAccount,
              amount: l.soldPart,
              label: `Diferencia de precio parte vendida: ${l.label}`,
            }),
          );
        }
        entryLines.push(
          JournalEntryLine.credit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: pendingDiffAccount,
            amount: totalDiff,
            label: `Diferencia de precio pendiente saldada: ${l.label}`,
          }),
        );
      } else {
        const absTotal = Math.abs(totalDiff);
        const absStock = Math.abs(l.stockPart);
        const absSold = Math.abs(l.soldPart);

        entryLines.push(
          JournalEntryLine.debit({
            id: `${params.id}-l${lineIdx++}`,
            accountId: pendingDiffAccount,
            amount: absTotal,
            label: `Diferencia de precio pendiente saldada (-): ${l.label}`,
          }),
        );
        if (absStock > 0) {
          entryLines.push(
            JournalEntryLine.credit({
              id: `${params.id}-l${lineIdx++}`,
              accountId: invAccount,
              amount: absStock,
              label: `Revaluación stock en bodega (-): ${l.label}`,
            }),
          );
        }
        if (absSold > 0) {
          entryLines.push(
            JournalEntryLine.credit({
              id: `${params.id}-l${lineIdx++}`,
              accountId: priceDiffAccount,
              amount: absSold,
              label: `Diferencia de precio parte vendida (-): ${l.label}`,
            }),
          );
        }
      }
    }

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: 'price_revaluation',
      originId: params.adjustmentId,
      description: 'Revaluación de inventario por diferencia de precio de compra',
      currency: params.currency,
      lines: entryLines,
    });
  }

  /**
   * §3.13 Asiento de apertura a fecha de corte:
   * Debe: Inventario (inventoryTotal)
   * Debe: Clientes por cobrar (receivablesTotal)
   * Haber: Proveedores por pagar (payablesTotal)
   * Haber o Debe: Patrimonio de apertura (equityTotal)
   */
  static openingBalance(
    params: EntryBaseParams & {
      documentId: string;
      inventoryTotal: number;
      receivablesTotal: number;
      payablesTotal: number;
      equityTotal: number;
    },
    company: CompanyAccountConfig,
  ): JournalEntry {
    const actualInvAccount = AccountResolver.resolveOperational('inventory', undefined, company);
    const receivablesAccount = AccountResolver.resolveCompany('receivables', company);
    const payablesAccount = AccountResolver.resolveCompany('payables', company);
    const equityAccount = AccountResolver.resolveCompany('openingEquity', company);

    const entryLines: JournalEntryLine[] = [];
    let lineIdx = 1;

    if (params.inventoryTotal > 0) {
      entryLines.push(
        JournalEntryLine.debit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: actualInvAccount,
          amount: params.inventoryTotal,
          label: 'Inventario inicial en bodega',
        }),
      );
    }

    if (params.receivablesTotal > 0) {
      entryLines.push(
        JournalEntryLine.debit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: receivablesAccount,
          amount: params.receivablesTotal,
          label: 'Saldos iniciales de clientes por cobrar',
        }),
      );
    }

    if (params.payablesTotal > 0) {
      entryLines.push(
        JournalEntryLine.credit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: payablesAccount,
          amount: params.payablesTotal,
          label: 'Saldos iniciales de proveedores por pagar',
        }),
      );
    }

    if (params.equityTotal > 0) {
      entryLines.push(
        JournalEntryLine.credit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: equityAccount,
          amount: params.equityTotal,
          label: 'Patrimonio de apertura (neto inicial)',
        }),
      );
    } else if (params.equityTotal < 0) {
      entryLines.push(
        JournalEntryLine.debit({
          id: `${params.id}-l${lineIdx++}`,
          accountId: equityAccount,
          amount: Math.abs(params.equityTotal),
          label: 'Patrimonio de apertura (déficit inicial)',
        }),
      );
    }

    return JournalEntry.create({
      id: params.id,
      tenantId: params.tenantId,
      code: params.code,
      entryDate: params.entryDate,
      originType: 'opening_balance',
      originId: params.documentId,
      description: 'Asiento de apertura de saldos vivos iniciales',
      currency: params.currency,
      lines: entryLines,
    });
  }
}
