import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { BUSINESS_CALENDAR, type BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import {
  INVOICE_REVALUATION_POSTING,
  type InvoiceRevaluationPosting,
  type InvoiceWarehouseRevaluationData,
  type InvoiceRevaluationLineData,
} from '../../../../shared/prisma/invoice-revaluation-posting.js';
import { effectiveRateToBase } from '../../../../shared/domain/purchase-price-difference.js';
import { RevaluationSourceMovementNotFoundError } from '../../../inventory/domain/errors/inventory.errors.js';
import {
  CreditNoteAlreadyCancelledError,
  CreditNoteLineAmountExceedsInvoiceError,
  CreditNoteLineItemMismatchError,
  CreditNoteNotConfirmableError,
  CreditNoteNotFoundError,
  CreditNoteReturnAlreadyCreditedError,
  CreditNoteReturnLinesNotFromInvoiceError,
  CreditNoteReturnSupplierMismatchError,
  CreditNoteReturnNotConfirmedError,
  CreditNoteWithApplicationsError,
  InvoiceNotPayableError,
  PayableInvoiceNotFoundError,
} from '../../domain/errors/payables.errors.js';
import {
  SupplierCreditNoteId,
  SupplierCreditNote,
} from '../../domain/credit-note/supplier-credit-note.entity.js';
import { SupplierCreditNotePosting } from '../../domain/credit-note/posting/supplier-credit-note-posting.js';
import { PayableCreditQuota } from '../../domain/credit-note/credit-quota.service.js';
import { SupplierPayment, PaymentId } from '../../domain/payment/supplier-payment.entity.js';
import { PAYABLES_CODE_SEQUENCE, type PayablesCodeSequence, payablesCode } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, CREDIT_NOTE_INCLUDE, creditNoteFromRow, CreditNoteRow, invoiceFromRow, invoiceSelect, PAYMENT_INCLUDE, paymentFromRow, PaymentRow } from './payables-rows.js';

@Injectable()
export class PrismaSupplierCreditNotePosting implements SupplierCreditNotePosting {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYABLES_CODE_SEQUENCE) private readonly codes: PayablesCodeSequence,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(INVOICE_REVALUATION_POSTING) private readonly revaluationPosting: InvoiceRevaluationPosting,
    @Inject(BUSINESS_CALENDAR) private readonly calendar: BusinessCalendar,
  ) {}

  async confirm(
    tenantId: TenantId,
    noteId: SupplierCreditNoteId,
    now: Date,
    today: string,
    userId?: string | null,
  ): Promise<{ creditNote: SupplierCreditNote; issuePayment: SupplierPayment | null }> {
    const tenant = tenantId.value;

    return await this.prisma.$transaction(async (tx) => {
      // Orden de bloqueo determinista: supplier_credit_notes -> purchase_invoices -> purchase_returns
      const lockedNotes = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM supplier_credit_notes
        WHERE tenant_id = ${tenant}::uuid AND id = ${noteId.value}::uuid
        FOR UPDATE`;

      if (lockedNotes.length === 0) {
        throw new CreditNoteNotFoundError(noteId.value);
      }

      const noteRow = (await tx.supplierCreditNote.findFirstOrThrow({
        where: { tenantId: tenant, id: noteId.value },
        include: CREDIT_NOTE_INCLUDE,
      })) as unknown as CreditNoteRow;

      const note = creditNoteFromRow(noteRow);

      if (note.currentStatus() !== 'draft') {
        throw new CreditNoteNotConfirmableError(noteId.value, note.currentStatus());
      }

      let issuePayment: SupplierPayment | null = null;

      // 1. Si cita factura: valida cupo de importe y crea pago si queda saldo vivo
      if (note.invoiceId()) {
        const invoiceId = note.invoiceId()!;
        const lockedInvoices = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM purchase_invoices
          WHERE tenant_id = ${tenant}::uuid AND id = ${invoiceId}::uuid
          FOR UPDATE`;

        if (lockedInvoices.length === 0) {
          throw new PayableInvoiceNotFoundError(invoiceId);
        }

        const invoiceRow = await tx.purchaseInvoice.findFirstOrThrow({
          where: { tenantId: tenant, id: invoiceId },
          select: invoiceSelect(),
        });

        if (invoiceRow.status !== 'confirmed') {
          throw new InvoiceNotPayableError(invoiceId);
        }

        const invoice = invoiceFromRow(invoiceRow);

        // Validación de líneas de la nota contra las líneas de la factura bajo FOR UPDATE
        const invoiceLines = await tx.purchaseInvoiceLine.findMany({
          where: { tenantId: tenant, invoiceId },
          include: {
            receiptLine: {
              include: {
                receipt: true,
              },
            },
          },
        });
        const invLinesMap = new Map(invoiceLines.map((il) => [il.id, il]));

        if (!note.purchaseReturnId()) {
          const otherConfirmedNoteLines = await tx.supplierCreditNoteLine.findMany({
            where: {
              tenantId: tenant,
              creditNote: {
                invoiceId,
                status: 'confirmed',
                id: { not: note.id.value },
              },
              invoiceLineId: { not: null },
            },
            select: {
              invoiceLineId: true,
              subtotal: true,
            },
          });
          const creditedByLineId = new Map<string, number>();
          for (const cl of otherConfirmedNoteLines) {
            if (!cl.invoiceLineId) continue;
            const current = creditedByLineId.get(cl.invoiceLineId) ?? 0;
            creditedByLineId.set(cl.invoiceLineId, current + Number(cl.subtotal));
          }

          const consumedInSameNote = new Map<string, number>();
          for (const line of noteRow.lines) {
            if (!line.invoiceLineId) continue;
            const invLine = invLinesMap.get(line.invoiceLineId);
            if (!invLine) continue;

            if (invLine.itemId && line.itemId && line.itemId !== invLine.itemId) {
              throw new CreditNoteLineItemMismatchError(
                line.id,
                invLine.itemId,
                line.itemId,
              );
            }
            if (invLine.itemId && !line.itemId) {
              throw new CreditNoteLineItemMismatchError(
                line.id,
                invLine.itemId,
                'none',
              );
            }

            const lineSubtotal = Number(line.subtotal);
            const priorConfirmed = creditedByLineId.get(line.invoiceLineId) ?? 0;
            const sameNoteSoFar = consumedInSameNote.get(line.invoiceLineId) ?? 0;
            const totalAttempted = priorConfirmed + sameNoteSoFar + lineSubtotal;
            const invLineSubtotal = Number(invLine.subtotal);

            if (totalAttempted > invLineSubtotal + 1e-4) {
              throw new CreditNoteLineAmountExceedsInvoiceError(
                line.id,
                totalAttempted,
                invLineSubtotal,
              );
            }

            consumedInSameNote.set(line.invoiceLineId, sameNoteSoFar + lineSubtotal);
          }
        }

        // Cupo de importe: notas confirmadas anteriores sobre la misma factura
        const otherConfirmedNotes = await tx.supplierCreditNote.aggregate({
          where: {
            tenantId: tenant,
            invoiceId,
            status: 'confirmed',
            id: { not: note.id.value },
          },
          _sum: { total: true },
        });

        const alreadyCredited = otherConfirmedNotes._sum.total ? otherConfirmedNotes._sum.total.toNumber() : 0;
        PayableCreditQuota.ensureWithinQuota(invoice.total(), alreadyCredited, note.total(), invoiceId);

        // Saldo vivo de la factura
        const liveBalance = invoice.balance();

        if (liveBalance > 0) {
          const appliedAmount = Math.min(liveBalance, note.total());
          const paymentId = PaymentId.of(this.ids.next());
          const paymentSeq = await this.codes.next(tenantId, 'PAG');
          const paymentCode = payablesCode('PAG', paymentSeq);
          const allocationId = this.ids.next();

          const notePrimitives = note.toPrimitives();

          // Crear pago confirmado que amortiza la factura
          const paymentDetails = {
            supplierId: note.supplierId(),
            date: note.issueDate(),
            method: 'credit_note' as const,
            creditSourceId: note.id.value,
            reference: `Nota de crédito ${note.code}`,
            notes: notePrimitives.notes,
            allocations: [{ id: allocationId, invoiceId, amount: appliedAmount }],
          };

          const settings = await tx.companySettings.findUnique({
            where: { tenantId: tenant },
            select: { amountDecimals: true },
          });
          const decimals = settings?.amountDecimals ?? 2;

          const invoiceRates = { [invoice.currency().currency]: notePrimitives.exchangeRate ?? 1 };
          const paymentRatesObj = {
            currency: note.currency(),
            invoiceRates,
            decimals,
          };

          issuePayment = SupplierPayment.draft(
            paymentId,
            tenantId,
            paymentCode,
            paymentDetails,
            [invoice],
            paymentRatesObj,
            now,
            today,
          );

          issuePayment.confirm([invoice], paymentRatesObj, now, today);
          const payPrimitives = issuePayment.toPrimitives();

          await tx.supplierPayment.create({
            data: {
              id: payPrimitives.id,
              tenantId: tenant,
              code: payPrimitives.code,
              supplierId: payPrimitives.supplierId,
              paymentDate: asDate(payPrimitives.paymentDate),
              method: payPrimitives.method,
              creditSourceId: payPrimitives.creditSourceId,
              reference: payPrimitives.reference,
              notes: payPrimitives.notes,
              amount: payPrimitives.amount,
              amountVes: payPrimitives.amountVes,
              currency: payPrimitives.currency,
              exchangeRate: payPrimitives.exchangeRate,
              baseCurrency: payPrimitives.baseCurrency,
              baseExchangeRate: payPrimitives.baseExchangeRate,
              manualExchangeRate: payPrimitives.manualExchangeRate,
              status: payPrimitives.status,
              confirmedAt: payPrimitives.confirmedAt,
              cancelledAt: payPrimitives.cancelledAt,
              createdAt: payPrimitives.createdAt,
              updatedAt: payPrimitives.updatedAt,
            },
          });

          await tx.supplierPaymentAllocation.createMany({
            data: payPrimitives.allocations.map((a) => ({
              id: a.id,
              tenantId: tenant,
              paymentId: payPrimitives.id,
              invoiceId: a.invoiceId,
              amount: a.amount,
              exchangeRate: a.exchangeRate,
              exchangeDifference: a.exchangeDifference,
            })),
          });

          note.assignIssuePayment(issuePayment.id.value);
        }
      }

      // 2. Si cita devolucion de compra: bloquear con FOR UPDATE, validar mismo proveedor y que no este acreditada
      if (note.purchaseReturnId()) {
        const returnId = note.purchaseReturnId()!;
        const lockedReturns = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM purchase_returns
          WHERE tenant_id = ${tenant}::uuid AND id = ${returnId}::uuid
          FOR UPDATE`;

        if (lockedReturns.length === 0) {
          throw new CreditNoteReturnNotConfirmedError(returnId, 'none');
        }

        const returnRow = await tx.purchaseReturn.findFirstOrThrow({
          where: { tenantId: tenant, id: returnId },
        });

        if (returnRow.status !== 'confirmed') {
          throw new CreditNoteReturnNotConfirmedError(returnId, returnRow.status);
        }

        if (returnRow.supplierId !== note.supplierId()) {
          throw new CreditNoteReturnSupplierMismatchError(returnId, note.supplierId());
        }

        const otherNoteWithReturn = await tx.supplierCreditNote.findFirst({
          where: {
            tenantId: tenant,
            purchaseReturnId: returnId,
            status: 'confirmed',
            id: { not: note.id.value },
          },
        });

        if (otherNoteWithReturn) {
          throw new CreditNoteReturnAlreadyCreditedError(returnId);
        }

        // H9 Defecto 1.6: Validar que las líneas de la devolución sean de líneas de entrada que esa factura facturó
        if (note.invoiceId()) {
          const returnLines = await tx.purchaseReturnLine.findMany({
            where: { tenantId: tenant, returnId },
            select: { receiptLineId: true },
          });
          const invoiceLines = await tx.purchaseInvoiceLine.findMany({
            where: { tenantId: tenant, invoiceId: note.invoiceId()! },
            select: { receiptLineId: true },
          });
          const invoiceReceiptLineIds = new Set(invoiceLines.map((il) => il.receiptLineId).filter(Boolean));
          const hasInvalid = returnLines.some((rl) => !invoiceReceiptLineIds.has(rl.receiptLineId));
          if (hasInvalid) {
            throw new CreditNoteReturnLinesNotFromInvoiceError(returnId, note.invoiceId()!);
          }
        }
      }

      // 3. Si es rebaja de mercancía sobre factura: generar revaluaciones por importe negativas (H9 §3.10, §4.4, Defecto 1.5)
      let totalPriceDifference = 0;
      let totalExchangeDifference = 0;
      const revaluationsByWarehouse = new Map<string, InvoiceRevaluationLineData[]>();

      if (note.invoiceId() && !note.purchaseReturnId()) {
        const linesWithInvoice = noteRow.lines.filter((l) => Boolean(l.invoiceLineId));

        if (linesWithInvoice.length > 0) {
          const invoiceLineIds = linesWithInvoice.map((l) => l.invoiceLineId!).filter(Boolean);
          const invoiceLines = await tx.purchaseInvoiceLine.findMany({
            where: { tenantId: tenant, id: { in: invoiceLineIds } },
            include: {
              receiptLine: {
                include: {
                  receipt: true,
                },
              },
            },
          });
          const invLinesMap = new Map(invoiceLines.map((il) => [il.id, il]));

          const receiptLineIds = invoiceLines
            .map((il) => il.receiptLineId)
            .filter((id): id is string => Boolean(id));

          const movements = receiptLineIds.length > 0
            ? await tx.inventoryMovement.findMany({
                where: {
                  tenantId: tenant,
                  originType: 'receipt',
                  originLineId: { in: receiptLineIds },
                },
                select: { id: true, originLineId: true },
              })
            : [];
          const movementByLineId = new Map(movements.map((m) => [m.originLineId!, m.id]));

          const notePrimitives = note.toPrimitives();
          const noteRate = effectiveRateToBase(
            notePrimitives.currency,
            notePrimitives.baseCurrency,
            notePrimitives.exchangeRate,
            notePrimitives.baseExchangeRate,
          );

          totalExchangeDifference = 0;

          for (const line of linesWithInvoice) {
            const invLine = invLinesMap.get(line.invoiceLineId!);
            if (!invLine || !invLine.receiptLine) continue;

            const receipt = invLine.receiptLine.receipt;
            const warehouseId = receipt.warehouseId;
            const lineSubtotal = Number(line.subtotal);

            const receiptRate = effectiveRateToBase(
              receipt.currency,
              receipt.baseCurrency,
              receipt.exchangeRate ? Number(receipt.exchangeRate) : null,
              receipt.baseExchangeRate ? Number(receipt.baseExchangeRate) : null,
            );

            // La rebaja disminuye el costo de inventario a tasa de recepción
            const amountBase = -1 * Number((lineSubtotal * receiptRate).toFixed(4));
            // Diferencia en cambio por variación de tipo de cambio entre recepción y nota
            const lineExchangeDiff = -1 * Number((lineSubtotal * (noteRate - receiptRate)).toFixed(4));

            totalPriceDifference += amountBase;
            totalExchangeDifference += lineExchangeDiff;

            const sourceMovementId = movementByLineId.get(invLine.receiptLineId!);
            if (!sourceMovementId) {
              throw new RevaluationSourceMovementNotFoundError(invLine.receiptLineId!);
            }

            const whLines = revaluationsByWarehouse.get(warehouseId) ?? [];
            whLines.push({
              lineNumber: whLines.length + 1,
              itemId: invLine.receiptLine.itemId,
              itemSku: line.itemSku ?? invLine.itemSku ?? '',
              itemName: line.itemName ?? invLine.itemName ?? '',
              unitId: invLine.receiptLine.unitId,
              amount: amountBase,
              sourceMovementId,
              reason: `Rebaja de precio segun nota de credito ${note.code}`,
            });
            revaluationsByWarehouse.set(warehouseId, whLines);
          }

          if (revaluationsByWarehouse.size > 0) {
            const revalData: InvoiceWarehouseRevaluationData[] = [...revaluationsByWarehouse.entries()].map(
              ([warehouseId, revalLines]) => ({ warehouseId, lines: revalLines }),
            );
            await this.revaluationPosting.createDraftRevaluations(
              tenantId,
              note.id.value,
              note.code,
              notePrimitives.issueDate,
              revalData,
              now,
              today,
              userId ?? null,
              tx,
              'supplier_credit_note',
            );
          }
        }
      }

      // 4. Confirmar la nota
      note.confirm(now, issuePayment ? issuePayment.id.value : null, totalPriceDifference, totalExchangeDifference);
      const updated = note.toPrimitives();

      await tx.supplierCreditNote.update({
        where: { tenantId_id: { tenantId: tenant, id: note.id.value } },
        data: {
          status: 'confirmed',
          issuePaymentId: updated.issuePaymentId,
          priceDifference: updated.priceDifference,
          exchangeDifference: updated.exchangeDifference,
          confirmedAt: updated.confirmedAt,
          updatedAt: updated.updatedAt,
        },
      });

      return { creditNote: note, issuePayment };
    });
  }

  async cancel(tenantId: TenantId, noteId: SupplierCreditNoteId, now: Date, userId?: string | null): Promise<void> {
    const tenant = tenantId.value;

    await this.prisma.$transaction(async (tx) => {
      const lockedNotes = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM supplier_credit_notes
        WHERE tenant_id = ${tenant}::uuid AND id = ${noteId.value}::uuid
        FOR UPDATE`;

      if (lockedNotes.length === 0) {
        throw new CreditNoteNotFoundError(noteId.value);
      }

      const noteRow = (await tx.supplierCreditNote.findFirstOrThrow({
        where: { tenantId: tenant, id: noteId.value },
        include: CREDIT_NOTE_INCLUDE,
      })) as unknown as CreditNoteRow;

      const note = creditNoteFromRow(noteRow);

      if (note.currentStatus() === 'cancelled') {
        throw new CreditNoteAlreadyCancelledError(noteId.value);
      }

      // Comprobar si se gasto su credito en pagos confirmados (distintos al pago de emision)
      const confirmedOtherPaymentsCount = await tx.supplierPayment.count({
        where: {
          tenantId: tenant,
          creditSourceId: note.id.value,
          status: 'confirmed',
          ...(note.issuePaymentId() ? { id: { not: note.issuePaymentId()! } } : {}),
        },
      });

      if (confirmedOtherPaymentsCount > 0) {
        throw new CreditNoteWithApplicationsError(note.id.value);
      }

      // Si tiene pago de emision y esta confirmado, anularlo respetando el orden determinista
      // (supplier_credit_notes bloqueada primero, supplier_payments a continuacion)
      if (note.issuePaymentId()) {
        const issuePaymentId = note.issuePaymentId()!;
        await tx.$queryRaw`
          SELECT id FROM supplier_payments
          WHERE tenant_id = ${tenant}::uuid AND id = ${issuePaymentId}::uuid
          FOR UPDATE`;

        const issuePaymentRow = await tx.supplierPayment.findFirst({
          where: { tenantId: tenant, id: issuePaymentId },
          include: PAYMENT_INCLUDE,
        });

        if (issuePaymentRow && issuePaymentRow.status === 'confirmed') {
          const payment = paymentFromRow(issuePaymentRow as unknown as PaymentRow);
          payment.cancel(now);

          await tx.supplierPayment.update({
            where: { tenantId_id: { tenantId: tenant, id: payment.id.value } },
            data: {
              status: 'cancelled',
              cancelledAt: now,
              updatedAt: now,
            },
          });
        }
      }

      const todayStr = await this.calendar.today(tenant);
      await this.revaluationPosting.cancelOrReverseRevaluations(
        tenantId,
        note.id.value,
        note.code,
        now,
        todayStr,
        userId ?? null,
        tx,
        'supplier_credit_note',
      );

      note.cancel(now);

      await tx.supplierCreditNote.update({
        where: { tenantId_id: { tenantId: tenant, id: note.id.value } },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          updatedAt: now,
        },
      });
    });
  }
}

