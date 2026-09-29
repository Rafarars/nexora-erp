import { beforeEach, describe, expect, it } from 'vitest';
import {
  CreditNoteAlreadyCancelledError,
  CreditNoteExceededError,
  CreditNoteNotEditableError,
  CreditNoteNotConfirmedError,
  CreditNoteReturnAlreadyCreditedError,
  CreditNoteReturnSupplierMismatchError,
  CreditNoteSupplierMismatchError,
  CreditNoteWithApplicationsError,
  EmptyCreditNoteError,
  IssuePaymentCannotBeCancelledDirectlyError,
  PayableSupplierNotFoundError,
} from '../domain/errors/payables.errors.js';
import {
  DOLLARS,
  INVOICE,
  OTHER_INVOICE,
  OTHER_SUPPLIER,
  SUPPLIER,
  TENANT_A,
  TENANT_B,
  TODAY,
} from '../domain/testing/payables.mother.js';
import { aPayablesScenario, PayablesScenario } from './testing/payables-scenario.js';

describe('Supplier Credit Notes (NCP) in Payables', () => {
  let s: PayablesScenario;

  beforeEach(async () => {
    s = aPayablesScenario();
    s.store.supplier(TENANT_A, { id: SUPPLIER, code: 'PRV900001', name: 'Distribuidor Delta', paymentTermDays: 15, isActive: true });
    s.store.supplier(TENANT_A, { id: OTHER_SUPPLIER, code: 'PRV900002', name: 'Suministros Omega', paymentTermDays: 0, isActive: true });
    // Factura de 100 USD
    s.store.invoice(TENANT_A, { id: INVOICE, code: 'FCP900001', supplierId: SUPPLIER, issueDate: '2026-01-05', dueDate: '2026-01-20', status: 'confirmed', total: 100, ...DOLLARS });
    // Factura de 50 USD
    s.store.invoice(TENANT_A, { id: OTHER_INVOICE, code: 'FCP900002', supplierId: SUPPLIER, issueDate: '2026-01-08', dueDate: '2026-01-25', status: 'confirmed', total: 50, ...DOLLARS });
  });

  it('crea una nota de credito en borrador y calcula subtotales e impuestos', async () => {
    const created = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      reason: 'subsequent_discount',
      notes: 'Descuento acordado',
      lines: [
        { concept: 'Descuento comercial', quantity: 1, unitPrice: 30, taxRate: 16 },
      ],
    });

    expect(created.code).toMatch(/^NCP\d{6}$/);

    const found = await s.searchCreditNotes.findById({ tenantId: TENANT_A, creditNoteId: created.id });
    expect(found.status).toBe('draft');
    expect(found.subtotal).toBe(30);
    expect(found.tax).toBe(4.8);
    expect(found.total).toBe(34.8);
    expect(found.supplier.name).toBe('Distribuidor Delta');
  });

  it('no permite crear una nota de credito sin lineas o para un proveedor inexistente', async () => {
    await expect(
      s.createCreditNote.run({
        tenantId: TENANT_A,
        supplierId: SUPPLIER,
        reason: 'damaged_goods',
        lines: [],
      }),
    ).rejects.toThrow(EmptyCreditNoteError);

    await expect(
      s.createCreditNote.run({
        tenantId: TENANT_A,
        supplierId: '00000000-0000-0000-0000-000000000000',
        reason: 'damaged_goods',
        lines: [{ concept: 'Devolucion', quantity: 1, unitPrice: 10, taxRate: 0 }],
      }),
    ).rejects.toThrow(PayableSupplierNotFoundError);
  });

  it('edita un borrador de nota de credito y rechaza editar una nota ya confirmada', async () => {
    const created = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      reason: 'subsequent_discount',
      lines: [{ concept: 'Concepto 1', quantity: 1, unitPrice: 20, taxRate: 0 }],
    });

    await s.updateCreditNote.run({
      tenantId: TENANT_A,
      creditNoteId: created.id,
      supplierId: SUPPLIER,
      reason: 'other',
      reasonDetail: 'Ajuste especial',
      lines: [{ concept: 'Concepto corregido', quantity: 2, unitPrice: 25, taxRate: 0 }],
    });

    let found = await s.searchCreditNotes.findById({ tenantId: TENANT_A, creditNoteId: created.id });
    expect(found.total).toBe(50);
    expect(found.reason).toBe('other');
    expect(found.reasonDetail).toBe('Ajuste especial');

    await s.confirmCreditNote.run({ tenantId: TENANT_A, creditNoteId: created.id });

    await expect(
      s.updateCreditNote.run({
        tenantId: TENANT_A,
        creditNoteId: created.id,
        supplierId: SUPPLIER,
        reason: 'other',
        reasonDetail: 'Cambio posterior',
        lines: [{ concept: 'Nuevo intento', quantity: 1, unitPrice: 10, taxRate: 0 }],
      }),
    ).rejects.toThrow(CreditNoteNotEditableError);
  });

  it('al confirmar una nota sobre una factura con saldo, emite un pago automatico (PAG) amortizando la factura', async () => {
    const created = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      invoiceId: INVOICE,
      reason: 'price_correction',
      lines: [{ concept: 'Rebaja de precio acordada', quantity: 1, unitPrice: 40, taxRate: 0 }],
    });

    await s.confirmCreditNote.run({ tenantId: TENANT_A, creditNoteId: created.id });

    const note = await s.searchCreditNotes.findById({ tenantId: TENANT_A, creditNoteId: created.id });
    expect(note.status).toBe('confirmed');
    expect(note.issuePaymentId).not.toBeNull();

    // La factura se amortizo por 40 USD (saldo vivo ahora es 60 USD)
    const invoices = await s.store.ledger.invoices(s.store.ledger ? { value: TENANT_A } as any : null, { ids: [INVOICE] });
    expect(invoices[0].balance()).toBe(60);

    // El pago automatico generado
    const payment = await s.store.payments.find({ value: TENANT_A } as any, { value: note.issuePaymentId! } as any);
    expect(payment?.toPrimitives().method).toBe('credit_note');
    expect(payment?.toPrimitives().creditSourceId).toBe(created.id);
    expect(payment?.toPrimitives().amount).toBe(40);
  });

  it('si la nota supera el saldo vivo de la factura, el remanente queda disponible para el proveedor', async () => {
    // Nota de 80 USD sobre una factura de 50 USD
    const created = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      invoiceId: OTHER_INVOICE, // Total 50 USD
      reason: 'damaged_goods',
      lines: [{ concept: 'Devolucion mayor', quantity: 1, unitPrice: 50, taxRate: 0 }],
    });

    await s.confirmCreditNote.run({ tenantId: TENANT_A, creditNoteId: created.id });

    // Saldo de la factura queda en 0
    const invoices = await s.store.ledger.invoices({ value: TENANT_A } as any, { ids: [OTHER_INVOICE] });
    expect(invoices[0].balance()).toBe(0);

    // Nota sin factura directa por 60 USD
    const unlinkedNote = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      reason: 'subsequent_discount',
      lines: [{ concept: 'Bono por volumen', quantity: 1, unitPrice: 60, taxRate: 0 }],
    });
    await s.confirmCreditNote.run({ tenantId: TENANT_A, creditNoteId: unlinkedNote.id });

    // Consultar cupos disponibles del proveedor
    const available = await s.availableCredits.run({ tenantId: TENANT_A, supplierId: SUPPLIER });
    expect(available.totalAvailableCredit).toBe(60);
    expect(available.notes).toHaveLength(1);
    expect(available.notes[0].id).toBe(unlinkedNote.id);
    expect(available.notes[0].availableCredit).toBe(60);
  });

  it('valida devolucion de compra citada: exige que pertenezca al proveedor y no permite acreditarla dos veces', async () => {
    const RETURN_ID = 'bb000000-0000-4000-8000-000000000001';
    s.store.purchaseReturn(TENANT_A, RETURN_ID, SUPPLIER, 'confirmed');

    // Nota que cita devolucion de compra
    const created = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      purchaseReturnId: RETURN_ID,
      reason: 'damaged_goods',
      lines: [{ concept: 'Devolucion fisica', quantity: 1, unitPrice: 25, taxRate: 0 }],
    });

    await s.confirmCreditNote.run({ tenantId: TENANT_A, creditNoteId: created.id });

    // Si otra nota intenta acreditar la misma devolucion confirmada
    const duplicate = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      purchaseReturnId: RETURN_ID,
      reason: 'damaged_goods',
      lines: [{ concept: 'Intento duplicado', quantity: 1, unitPrice: 25, taxRate: 0 }],
    });

    await expect(
      s.confirmCreditNote.run({ tenantId: TENANT_A, creditNoteId: duplicate.id }),
    ).rejects.toThrow(CreditNoteReturnAlreadyCreditedError);

    // Si la devolucion fuera de otro proveedor
    const OTHER_RETURN = 'bb000000-0000-4000-8000-000000000002';
    s.store.purchaseReturn(TENANT_A, OTHER_RETURN, OTHER_SUPPLIER, 'confirmed');

    const mismatch = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      purchaseReturnId: OTHER_RETURN,
      reason: 'damaged_goods',
      lines: [{ concept: 'Mismatch', quantity: 1, unitPrice: 10, taxRate: 0 }],
    });

    await expect(
      s.confirmCreditNote.run({ tenantId: TENANT_A, creditNoteId: mismatch.id }),
    ).rejects.toThrow(CreditNoteReturnSupplierMismatchError);
  });

  it('permite aplicar el credito disponible de una nota en un pago posterior a proveedor', async () => {
    // Nota sin factura por 70 USD
    const noteCreated = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      reason: 'subsequent_discount',
      lines: [{ concept: 'Credito comercial', quantity: 1, unitPrice: 70, taxRate: 0 }],
    });
    await s.confirmCreditNote.run({ tenantId: TENANT_A, creditNoteId: noteCreated.id });

    // Pagar 40 USD de INVOICE (que debe 100 USD) usando el saldo de la nota
    const paymentCreated = await s.createPayment.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      method: 'credit_note',
      creditSourceId: noteCreated.id,
      allocations: [{ invoiceId: INVOICE, amount: 40 }],
    });

    await s.confirmPayment.run({ tenantId: TENANT_A, paymentId: paymentCreated.id });

    // Factura ahora debe 60 USD
    const invoices = await s.store.ledger.invoices({ value: TENANT_A } as any, { ids: [INVOICE] });
    expect(invoices[0].balance()).toBe(60);

    // Cupo restante de la nota ahora es 30 USD
    const available = await s.availableCredits.run({ tenantId: TENANT_A, supplierId: SUPPLIER });
    expect(available.totalAvailableCredit).toBe(30);

    // Si otro pago intenta gastar mas de los 30 USD restantes (ej. 35 USD)
    const overPayment = await s.createPayment.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      method: 'credit_note',
      creditSourceId: noteCreated.id,
      allocations: [{ invoiceId: INVOICE, amount: 35 }],
    });

    await expect(
      s.confirmPayment.run({ tenantId: TENANT_A, paymentId: overPayment.id }),
    ).rejects.toThrow(CreditNoteExceededError);
  });

  it('rechaza pagar con nota de credito que no esta confirmada o pertenece a otro proveedor', async () => {
    const draftNote = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      reason: 'subsequent_discount',
      lines: [{ concept: 'Credito en borrador', quantity: 1, unitPrice: 50, taxRate: 0 }],
    });

    const paymentWithDraft = await s.createPayment.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      method: 'credit_note',
      creditSourceId: draftNote.id,
      allocations: [{ invoiceId: INVOICE, amount: 20 }],
    });

    await expect(
      s.confirmPayment.run({ tenantId: TENANT_A, paymentId: paymentWithDraft.id }),
    ).rejects.toThrow(CreditNoteNotConfirmedError);

    // Nota de otro proveedor
    const otherNote = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: OTHER_SUPPLIER,
      reason: 'subsequent_discount',
      lines: [{ concept: 'Credito de otro proveedor', quantity: 1, unitPrice: 50, taxRate: 0 }],
    });
    await s.confirmCreditNote.run({ tenantId: TENANT_A, creditNoteId: otherNote.id });

    const paymentWithMismatch = await s.createPayment.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      method: 'credit_note',
      creditSourceId: otherNote.id,
      allocations: [{ invoiceId: INVOICE, amount: 20 }],
    });

    await expect(
      s.confirmPayment.run({ tenantId: TENANT_A, paymentId: paymentWithMismatch.id }),
    ).rejects.toThrow(CreditNoteSupplierMismatchError);
  });

  it('anula una nota de credito: revierte el pago de emision (PAG) y restaura el saldo de la factura', async () => {
    const created = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      invoiceId: INVOICE,
      reason: 'price_correction',
      lines: [{ concept: 'Descuento', quantity: 1, unitPrice: 30, taxRate: 0 }],
    });

    await s.confirmCreditNote.run({ tenantId: TENANT_A, creditNoteId: created.id });

    // Saldo de factura es 70
    let invoices = await s.store.ledger.invoices({ value: TENANT_A } as any, { ids: [INVOICE] });
    expect(invoices[0].balance()).toBe(70);

    // Anular la nota de credito
    await s.cancelCreditNote.run({ tenantId: TENANT_A, creditNoteId: created.id });

    const note = await s.searchCreditNotes.findById({ tenantId: TENANT_A, creditNoteId: created.id });
    expect(note.status).toBe('cancelled');

    // El saldo de la factura se restauro a 100 USD
    invoices = await s.store.ledger.invoices({ value: TENANT_A } as any, { ids: [INVOICE] });
    expect(invoices[0].balance()).toBe(100);

    // Intentar anularla de nuevo
    await expect(
      s.cancelCreditNote.run({ tenantId: TENANT_A, creditNoteId: created.id }),
    ).rejects.toThrow(CreditNoteAlreadyCancelledError);
  });

  it('impide anular una nota de credito si ya tiene pagos externos confirmados aplicados', async () => {
    const noteCreated = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      reason: 'subsequent_discount',
      lines: [{ concept: 'Credito comercial', quantity: 1, unitPrice: 50, taxRate: 0 }],
    });
    await s.confirmCreditNote.run({ tenantId: TENANT_A, creditNoteId: noteCreated.id });

    // Aplicar 20 USD en un pago confirmado
    const payment = await s.createPayment.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      method: 'credit_note',
      creditSourceId: noteCreated.id,
      allocations: [{ invoiceId: INVOICE, amount: 20 }],
    });
    await s.confirmPayment.run({ tenantId: TENANT_A, paymentId: payment.id });

    // Intentar anular la nota debe fallar
    await expect(
      s.cancelCreditNote.run({ tenantId: TENANT_A, creditNoteId: noteCreated.id }),
    ).rejects.toThrow(CreditNoteWithApplicationsError);
  });

  it('impide anular directamente desde Pagos un pago emitido automaticamente por una nota de credito activa', async () => {
    const noteCreated = await s.createCreditNote.run({
      tenantId: TENANT_A,
      supplierId: SUPPLIER,
      invoiceId: INVOICE,
      reason: 'subsequent_discount',
      lines: [{ concept: 'Descuento', quantity: 1, unitPrice: 25, taxRate: 0 }],
    });
    await s.confirmCreditNote.run({ tenantId: TENANT_A, creditNoteId: noteCreated.id });

    const note = await s.searchCreditNotes.findById({ tenantId: TENANT_A, creditNoteId: noteCreated.id });
    const issuePaymentId = note.issuePaymentId!;
    expect(issuePaymentId).toBeDefined();

    // Intentar anular ese pago directamente con cancelPayment
    await expect(
      s.cancelPayment.run({ tenantId: TENANT_A, paymentId: issuePaymentId }),
    ).rejects.toThrow(IssuePaymentCannotBeCancelledDirectlyError);
  });
});
