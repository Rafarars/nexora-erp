import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TransactionClient } from '../../../../shared/prisma/document-stock-posting.js';
import type {
  AccountingEvent,
  DocumentAccountingPosting,
} from '../../../../shared/prisma/document-accounting-posting.js';
import {
  AccountResolver,
  CompanyAccountConfig,
  OperationalLineAccountContext,
} from '../../domain/determination/account-resolver.js';
import { EntryBaseParams, EntryBuilder } from '../../domain/journal/entry-builder.js';
import { JournalEntryLine } from '../../domain/journal/journal-entry-line.entity.js';
import { JournalEntry } from '../../domain/journal/journal-entry.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asUuid(id: string): string {
  return UUID_REGEX.test(id) ? id : randomUUID();
}

@Injectable()
export class PrismaDocumentAccountingPosting implements DocumentAccountingPosting {
  async post(tx: TransactionClient, tenantId: string, event: AccountingEvent): Promise<void> {
    if (event.kind === 'document-cancelled') {
      await this.handleCancellation(tx, tenantId, event);
      return;
    }

    // 1. Obtener configuración contable de la empresa
    const settings = await tx.companySettings.findFirst({
      where: { tenantId },
    });

    const companyAccounts: CompanyAccountConfig = {
      inventoryAccountId: settings?.inventoryAccountId ?? null,
      cogsAccountId: settings?.cogsAccountId ?? null,
      salesRevenueAccountId: settings?.salesRevenueAccountId ?? null,
      taxPayableAccountId: settings?.taxPayableAccountId ?? null,
      receivablesAccountId: settings?.receivablesAccountId ?? null,
      payablesAccountId: settings?.payablesAccountId ?? null,
      cashAccountId: settings?.cashAccountId ?? null,
      inventoryAdjustmentAccountId: settings?.inventoryAdjustmentAccountId ?? null,
      unappliedCreditNotesAccountId: settings?.unappliedCreditNotesAccountId ?? null,
      unappliedSupplierCreditNotesAccountId: settings?.unappliedSupplierCreditNotesAccountId ?? null,
      unbilledGoodsAccountId: settings?.unbilledGoodsAccountId ?? null,
      priceDifferenceAccountId: settings?.priceDifferenceAccountId ?? null,
      purchaseExpenseAccountId: settings?.purchaseExpenseAccountId ?? null,
      pendingPriceDifferenceAccountId: settings?.pendingPriceDifferenceAccountId ?? null,
      exchangeDifferenceAccountId: settings?.exchangeDifferenceAccountId ?? null,
      openingEquityAccountId: settings?.openingEquityAccountId ?? null,
    };

    const currency = event.currency ?? settings?.baseCurrency ?? 'USD';
    const entryDate = typeof event.date === 'string' ? new Date(event.date) : event.date;

    // 2. Resolver contextos operacionales de artículos y categorías involucrados
    const itemIds = this.extractItemIds(event);
    const itemContexts = await this.loadItemContexts(tx, tenantId, itemIds);

    // 3. Generar el código de asiento en la transacción
    const code = await this.nextCode(tx, tenantId);
    const entryId = randomUUID();

    const baseParams: EntryBaseParams = {
      id: entryId,
      tenantId: TenantId.of(tenantId),
      code,
      entryDate,
      currency,
    };

    // 4. Construir asiento contable según tipo de evento
    const entry = this.buildEntry(event, baseParams, companyAccounts, itemContexts);
    if (!entry) {
      return;
    }

    // 5. Persistir cabecera y líneas en la misma transacción
    await tx.journalEntry.create({
      data: {
        id: entry.id,
        tenantId,
        code: entry.code,
        entryDate: entry.entryDate,
        originType: entry.originType,
        originId: entry.originId,
        description: entry.description,
        currency: entry.currency,
        reversalOfId: entry.reversalOfId,
      },
    });

    if (entry.lines.length > 0) {
      await tx.journalEntryLine.createMany({
        data: entry.lines.map((l) => ({
          id: asUuid(l.id),
          tenantId,
          entryId: entry.id,
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          label: l.label,
        })),
      });
    }
  }

  private async handleCancellation(
    tx: TransactionClient,
    tenantId: string,
    event: { originType: string; originId: string; date: Date | string },
  ): Promise<void> {
    // Buscar el asiento original confirmado que no sea reverso
    const originalRow = await tx.journalEntry.findFirst({
      where: {
        tenantId,
        originType: event.originType,
        originId: event.originId,
        reversalOfId: null,
      },
      include: { lines: true },
    });

    if (!originalRow) {
      return;
    }

    const lines = originalRow.lines.map((l) =>
      JournalEntryLine.fromPrimitives({
        id: l.id,
        accountId: l.accountId,
        debit: Number(l.debit),
        credit: Number(l.credit),
        label: l.label,
      }),
    );

    const originalEntry = JournalEntry.create({
      id: originalRow.id,
      tenantId: TenantId.of(originalRow.tenantId),
      code: originalRow.code,
      entryDate: originalRow.entryDate,
      originType: originalRow.originType,
      originId: originalRow.originId,
      description: originalRow.description,
      currency: originalRow.currency,
      reversalOfId: originalRow.reversalOfId,
      lines,
    });

    const newCode = await this.nextCode(tx, tenantId);
    const reversalId = randomUUID();
    const reversalDate = typeof event.date === 'string' ? new Date(event.date) : event.date;

    const reversalEntry = originalEntry.reverse({
      id: reversalId,
      code: newCode,
      date: reversalDate,
      description: `Reverso de ${originalEntry.code}`,
      lineIds: () => randomUUID(),
    });

    await tx.journalEntry.create({
      data: {
        id: reversalEntry.id,
        tenantId,
        code: reversalEntry.code,
        entryDate: reversalEntry.entryDate,
        originType: reversalEntry.originType,
        originId: reversalEntry.originId,
        description: reversalEntry.description,
        currency: reversalEntry.currency,
        reversalOfId: reversalEntry.reversalOfId,
      },
    });

    await tx.journalEntryLine.createMany({
      data: reversalEntry.lines.map((l) => ({
        id: asUuid(l.id),
        tenantId,
        entryId: reversalEntry.id,
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        label: l.label,
      })),
    });
  }

  private buildEntry(
    event: AccountingEvent,
    baseParams: EntryBaseParams,
    company: CompanyAccountConfig,
    contexts: Map<string, OperationalLineAccountContext>,
  ): JournalEntry | null {
    switch (event.kind) {
      case 'goods-received': {
        const lines = event.lines.map((l) => ({
          context: contexts.get(l.itemId),
          amount: l.amount ?? Number((l.quantity * l.unitCost).toFixed(2)),
          label: l.label ?? `Artículo ${l.itemId}`,
        }));
        return EntryBuilder.goodsReceived({ ...baseParams, receiptId: event.documentId, lines }, company);
      }

      case 'goods-dispatched': {
        const lines = event.lines.map((l) => ({
          context: contexts.get(l.itemId),
          amount: l.amount ?? Number((l.quantity * l.unitCost).toFixed(2)),
          label: l.label ?? `Artículo ${l.itemId}`,
        }));
        return EntryBuilder.goodsDispatched({ ...baseParams, dispatchId: event.documentId, lines }, company);
      }

      case 'sales-invoice-issued': {
        const lines = event.lines.map((l) => ({
          context: l.itemId ? contexts.get(l.itemId) : undefined,
          subtotal: l.subtotal,
          label: l.label ?? (l.concept ?? 'Venta'),
        }));
        return EntryBuilder.salesInvoiceIssued(
          { ...baseParams, invoiceId: event.documentId, lines, tax: event.tax, total: event.total },
          company,
        );
      }

      case 'purchase-invoice-confirmed': {
        const serviceLines = event.pricing.serviceLines.map((s) => ({
          context: s.itemId ? contexts.get(s.itemId) : undefined,
          amount: s.subtotal,
          label: s.label ?? (s.concept ?? 'Servicio'),
        }));
        return EntryBuilder.purchaseInvoiceConfirmed(
          {
            ...baseParams,
            invoiceId: event.documentId,
            baseCost: event.pricing.baseCost,
            priceDifference: event.pricing.priceDifference,
            exchangeDifference: event.pricing.exchangeDifference,
            serviceLines,
            tax: event.pricing.tax,
            total: event.pricing.total,
          },
          company,
        );
      }

      case 'payment-received': {
        if (event.creditSourceId) {
          return EntryBuilder.paymentReceivedWithoutMoney(
            { ...baseParams, paymentId: event.documentId, amount: event.amount },
            company,
          );
        }
        return EntryBuilder.paymentReceived(
          {
            ...baseParams,
            paymentId: event.documentId,
            amountPaid: event.amount,
            allocatedAmount: event.allocatedAmount,
            exchangeDifference: event.exchangeDifference,
          },
          company,
        );
      }

      case 'payment-made': {
        if (event.creditSourceId) {
          return EntryBuilder.supplierCreditNotePaymentWithoutMoney(
            { ...baseParams, paymentId: event.documentId, amount: event.amount },
            company,
          );
        }
        return EntryBuilder.paymentMade(
          {
            ...baseParams,
            paymentId: event.documentId,
            amountPaid: event.amount,
            allocatedAmount: event.allocatedAmount,
            exchangeDifference: event.exchangeDifference,
          },
          company,
        );
      }

      case 'customer-credit-note-issued': {
        const lines = event.lines.map((l) => ({
          context: l.itemId ? contexts.get(l.itemId) : undefined,
          subtotal: l.subtotal,
          label: l.label ?? (l.concept ?? 'Rebaja'),
        }));
        return EntryBuilder.customerCreditNoteIssued(
          { ...baseParams, creditNoteId: event.documentId, lines, tax: event.tax, total: event.total },
          company,
        );
      }

      case 'supplier-credit-note-issued': {
        const serviceLines = event.pricing.serviceLines.map((s) => ({
          context: s.itemId ? contexts.get(s.itemId) : undefined,
          amount: s.subtotal,
          label: s.label ?? (s.concept ?? 'Servicio'),
        }));
        return EntryBuilder.supplierCreditNoteIssued(
          {
            ...baseParams,
            creditNoteId: event.documentId,
            total: event.pricing.total,
            tax: event.pricing.tax,
            serviceLines,
            creditsReturn: event.creditsReturn,
            priceDiscount: event.creditsReturn ? 0 : Math.abs(event.pricing.priceDifference),
            priceDifference: event.creditsReturn ? event.pricing.priceDifference : 0,
            exchangeDifference: event.pricing.exchangeDifference,
          },
          company,
        );
      }

      case 'goods-returned': {
        // Si no hay líneas o todas tienen costo 0 (p. ej. scrap sin costo recuperable), no genera asiento
        const activeLines = event.lines.filter((l) => (l.amount ?? l.quantity * l.unitCost) > 0);
        if (activeLines.length === 0) {
          return null;
        }
        const lines = activeLines.map((l) => ({
          context: contexts.get(l.itemId),
          amount: l.amount ?? Number((l.quantity * l.unitCost).toFixed(2)),
          hasOriginMovement: l.restoresMovementId !== null,
          label: l.label ?? `Devolución ${l.itemId}`,
        }));
        return EntryBuilder.goodsReturned(
          { ...baseParams, returnId: event.documentId, side: event.side, lines },
          company,
        );
      }

      case 'stock-adjusted': {
        const lines = event.lines.map((l) => ({
          context: contexts.get(l.itemId),
          amount: l.amount ?? Number((l.quantity * l.unitCost).toFixed(2)),
          label: l.label ?? `Ajuste ${l.itemId}`,
        }));
        return EntryBuilder.stockAdjusted(
          { ...baseParams, adjustmentId: event.documentId, direction: event.direction, lines },
          company,
        );
      }

      case 'purchase-price-revalued': {
        const lines = event.lines.map((l) => ({
          context: contexts.get(l.itemId),
          stockPart: l.split.stockPart,
          soldPart: l.split.soldPart,
          label: `Revaluación ${l.itemId}`,
        }));
        return EntryBuilder.purchasePriceRevalued(
          { ...baseParams, adjustmentId: event.documentId, lines },
          company,
        );
      }

      case 'opening-balance': {
        return EntryBuilder.openingBalance(
          {
            ...baseParams,
            documentId: event.documentId,
            inventoryTotal: event.inventoryTotal,
            receivablesTotal: event.receivablesTotal,
            payablesTotal: event.payablesTotal,
            equityTotal: event.equityTotal,
          },
          company,
        );
      }

      case 'document-cancelled':
        return null;
    }
  }

  private extractItemIds(event: AccountingEvent): string[] {
    const ids = new Set<string>();
    if ('lines' in event && Array.isArray(event.lines)) {
      for (const line of event.lines) {
        if ('itemId' in line && line.itemId) {
          ids.add(line.itemId);
        }
      }
    }
    if ('pricing' in event && event.pricing && Array.isArray(event.pricing.serviceLines)) {
      for (const line of event.pricing.serviceLines) {
        if (line.itemId) {
          ids.add(line.itemId);
        }
      }
    }
    return Array.from(ids);
  }

  private async loadItemContexts(
    tx: TransactionClient,
    tenantId: string,
    itemIds: string[],
  ): Promise<Map<string, OperationalLineAccountContext>> {
    const map = new Map<string, OperationalLineAccountContext>();
    if (itemIds.length === 0) return map;

    const items = await tx.item.findMany({
      where: { tenantId, id: { in: itemIds } },
      include: { category: true },
    });

    for (const item of items) {
      map.set(item.id, {
        item: {
          inventoryAccountId: item.inventoryAccountId,
          cogsAccountId: item.cogsAccountId,
          salesRevenueAccountId: item.salesRevenueAccountId,
          purchaseExpenseAccountId: item.purchaseExpenseAccountId,
        },
        category: item.category
          ? {
              inventoryAccountId: item.category.inventoryAccountId,
              cogsAccountId: item.category.cogsAccountId,
              salesRevenueAccountId: item.category.salesRevenueAccountId,
              purchaseExpenseAccountId: item.category.purchaseExpenseAccountId,
            }
          : null,
      });
    }

    return map;
  }

  private async nextCode(tx: TransactionClient, tenantId: string): Promise<string> {
    const [row] = await tx.$queryRaw<{ last_value: number }[]>`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId}::uuid, 'AST', 1)
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = code_sequences.last_value + 1
      RETURNING last_value`;

    const sequence = Number(row.last_value);
    return `AST-${String(sequence).padStart(6, '0')}`;
  }
}
