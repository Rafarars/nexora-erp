'use server';

import { revalidatePath } from 'next/cache';
import { parseDecimal } from '@/modules/catalog/domain/catalog';
import type { CreditNoteReason } from '@/modules/payables/domain/payables';
import { readablePayablesError } from '@/modules/payables/domain/payables-error';
import { payablesApi } from '@/shared/session/payables-api';
import { purchasingApi } from '@/shared/session/purchasing-api';
import { requireSession } from '@/shared/session/current-session';
import type { FormState } from '@/shared/forms/form-state';

const text = (form: FormData, name: string) => String(form.get(name) ?? '');
const optional = (form: FormData, name: string) => text(form, name).trim() || null;
// Vacia es la tasa del dia; lo que no es un numero viaja como NaN y la API senala el campo.
const rate = (form: FormData) => (text(form, 'exchangeRate').trim() === '' ? null : parseDecimal(text(form, 'exchangeRate')));

async function attempt(fallback: string, work: (token: string) => Promise<void>): Promise<FormState> {
  const { token } = await requireSession();

  try {
    await work(token);
  } catch (error) {
    return { error: readablePayablesError(error, fallback), done: false };
  }

  revalidatePath('/cuentas-por-pagar', 'layout');

  return { error: null, done: true };
}

// Los montos vacios no son parte del pago: solo se envian las facturas a las que se les aplica algo.
export async function savePayment(_state: FormState, form: FormData): Promise<FormState> {
  const invoices = form.getAll('allocationInvoice').map(String);
  const amounts = form.getAll('allocationAmount').map(String);

  return attempt('No se pudo guardar el pago.', (token) =>
    payablesApi().savePayment(token, optional(form, 'id'), {
      supplierId: text(form, 'supplierId'),
      date: optional(form, 'date'),
      method: text(form, 'method'),
      creditSourceId: optional(form, 'creditSourceId'),
      reference: optional(form, 'reference'),
      notes: optional(form, 'notes'),
      currency: optional(form, 'currency'),
      exchangeRate: rate(form),
      allocations: invoices
        .map((invoiceId, index) => ({ invoiceId, raw: (amounts[index] ?? '').trim() }))
        .filter(({ raw }) => raw !== '')
        .map(({ invoiceId, raw }) => ({ invoiceId, amount: parseDecimal(raw) })),
    }),
  );
}

export async function changePayment(_state: FormState, form: FormData): Promise<FormState> {
  const id = text(form, 'id');

  if (form.get('extra') === 'confirm') return attempt('No se pudo confirmar el pago.', (token) => payablesApi().confirmPayment(token, id));

  return attempt('No se pudo anular el pago.', (token) => payablesApi().cancelPayment(token, id));
}

export async function saveCreditNote(_state: FormState, form: FormData): Promise<FormState> {
  const lineConcepts = form.getAll('lineConcept').map(String);
  const lineQuantities = form.getAll('lineQuantity').map(String);
  const linePrices = form.getAll('linePrice').map(String);
  const lineTaxes = form.getAll('lineTax').map(String);
  const lineInvoiceLineIds = form.getAll('lineInvoiceLineId').map(String);
  const lineItemIds = form.getAll('lineItemId').map(String);
  const lineItemSkus = form.getAll('lineItemSku').map(String);
  const lineItemNames = form.getAll('lineItemName').map(String);
  const lineUnitIds = form.getAll('lineUnitId').map(String);

  return attempt('No se pudo guardar la nota de crédito.', (token) =>
    payablesApi().saveCreditNote(token, optional(form, 'id'), {
      supplierId: text(form, 'supplierId'),
      invoiceId: optional(form, 'invoiceId'),
      purchaseReturnId: optional(form, 'purchaseReturnId'),
      date: optional(form, 'date') ?? optional(form, 'issueDate'),
      reason: text(form, 'reason') as CreditNoteReason,
      reasonDetail: optional(form, 'reasonDetail'),
      notes: optional(form, 'notes'),
      currency: optional(form, 'currency'),
      exchangeRate: rate(form),
      lines: lineConcepts.map((concept, index) => ({
        invoiceLineId: optional(form, 'purchaseReturnId') ? null : (lineInvoiceLineIds[index]?.trim() || null),
        itemId: lineItemIds[index]?.trim() || null,
        itemSku: lineItemSkus[index]?.trim() || null,
        itemName: lineItemNames[index]?.trim() || null,
        unitId: lineUnitIds[index]?.trim() || null,
        concept: concept.trim() || null,
        quantity: parseDecimal(lineQuantities[index] ?? '1'),
        unitPrice: parseDecimal(linePrices[index] ?? '0'),
        taxRate: parseDecimal(lineTaxes[index] ?? '0'),
      })),
    }),
  );
}

export async function changeCreditNote(_state: FormState, form: FormData): Promise<FormState> {
  const id = text(form, 'id');

  if (form.get('extra') === 'confirm') return attempt('No se pudo confirmar la nota de crédito.', (token) => payablesApi().confirmCreditNote(token, id));

  return attempt('No se pudo anular la nota de crédito.', (token) => payablesApi().cancelCreditNote(token, id));
}

export async function getPurchaseInvoice(invoiceId: string) {
  if (!invoiceId) return null;
  const { token } = await requireSession();
  try {
    const invoice = await purchasingApi().findInvoice(token, invoiceId);
    return {
      id: invoice.id,
      code: invoice.code,
      lines: invoice.lines,
    };
  } catch {
    return null;
  }
}

export async function getSupplierAvailableCredits(supplierId: string) {
  if (!supplierId) return [];
  const { token } = await requireSession();
  try {
    return await payablesApi().availableCredits(token, supplierId);
  } catch {
    return [];
  }
}

export interface EligiblePurchaseReturn {
  id: string;
  code: string;
  date: string;
  lines: Array<{
    id: string;
    receiptLineId: string;
    itemId: string;
    itemSku: string;
    itemName: string;
    unitId: string;
    concept: string;
    quantity: number;
    unitCost: number;
  }>;
}

export async function getEligiblePurchaseReturns(invoiceId: string, supplierId: string): Promise<EligiblePurchaseReturn[]> {
  if (!invoiceId || !supplierId) return [];
  const { token } = await requireSession();
  try {
    const invoice = await purchasingApi().findInvoice(token, invoiceId);
    if (!invoice || !invoice.lines || invoice.lines.length === 0) return [];

    const invoiceReceiptLineIds = new Set(
      invoice.lines.map((l) => l.receiptLineId).filter((id): id is string => Boolean(id)),
    );
    if (invoiceReceiptLineIds.size === 0) return [];

    const [returnsPage, notesPage] = await Promise.all([
      purchasingApi().searchReturns(token, { supplierId }),
      payablesApi().searchCreditNotes(token, { supplierId }),
    ]);

    const creditedReturnIds = new Set(
      (notesPage.creditNotes ?? [])
        .filter((n) => n.status !== 'cancelled' && (n.purchaseReturn?.id || n.purchaseReturnId))
        .map((n) => n.purchaseReturn?.id ?? n.purchaseReturnId),
    );

    const confirmedReturns = (returnsPage.returns ?? []).filter((r) => r.status === 'confirmed');

    return confirmedReturns
      .filter((ret) => {
        if (creditedReturnIds.has(ret.id)) return false;
        if (!ret.lines || ret.lines.length === 0) return false;
        return ret.lines.every((rl) => invoiceReceiptLineIds.has(rl.receiptLineId));
      })
      .map((ret) => ({
        id: ret.id,
        code: ret.code,
        date: ret.date,
        lines: ret.lines.map((rl) => ({
          id: rl.id,
          receiptLineId: rl.receiptLineId,
          itemId: rl.itemId,
          itemSku: rl.sku,
          itemName: rl.itemName,
          unitId: rl.unitId,
          concept: rl.itemName ? `Devolución ${ret.code} - ${rl.itemName}` : `Devolución ${ret.code}`,
          quantity: rl.quantity,
          unitCost: rl.unitCost,
        })),
      }));
  } catch {
    return [];
  }
}


