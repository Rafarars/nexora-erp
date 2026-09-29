import { FixedDocumentRates } from '../../../../shared/infrastructure/testing/fixed-document-rates.js';
import { ClockBusinessCalendar } from '../../../../shared/infrastructure/testing/clock-business-calendar.js';
import { FixedClock } from '../../../../shared/infrastructure/testing/fixed-clock.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { PaymentFinder } from '../../domain/payment/find/payment-finder.js';
import { NOW } from '../../domain/testing/payables.mother.js';
import { InMemoryPayablesCodeSequence } from '../../infrastructure/testing/in-memory-payables-code-sequence.js';
import { InMemoryPayablesStore } from '../../infrastructure/testing/in-memory-payables-store.js';
import { PaymentCanceller } from '../cancel-payment/payment-canceller.js';
import { PaymentConfirmer } from '../confirm-payment/payment-confirmer.js';
import { PaymentCreator } from '../create-payment/payment-creator.js';
import { PaymentSearcher } from '../search-payments/payment-searcher.js';
import { PaymentUpdater } from '../update-payment/payment-updater.js';
import { SupplierCreditNoteCreator } from '../create-credit-note/supplier-credit-note-creator.js';
import { SupplierCreditNoteUpdater } from '../update-credit-note/supplier-credit-note-updater.js';
import { SupplierCreditNoteConfirmer } from '../confirm-credit-note/supplier-credit-note-confirmer.js';
import { SupplierCreditNoteCanceller } from '../cancel-credit-note/supplier-credit-note-canceller.js';
import { SupplierCreditNoteSearcher } from '../search-credit-notes/supplier-credit-note-searcher.js';
import { SupplierAvailableCreditsFinder } from '../supplier-available-credits/supplier-available-credits-finder.js';

// El mundo de una prueba de aplicacion de cuentas por pagar: proveedores y facturas que en la base
// escribe compras, reloj congelado y sin base de datos ni NestJS.
export function aPayablesScenario() {
  const clock = new FixedClock(NOW);
  const calendar = new ClockBusinessCalendar(clock);
  const ids = new SequentialIdGenerator();
  const store = new InMemoryPayablesStore();
  const codes = new InMemoryPayablesCodeSequence();
  const finder = new PaymentFinder(store.payments);
  const rates = new FixedDocumentRates();

  return {
    clock,
    calendar,
    store,
    rates,
    codes,
    createPayment: new PaymentCreator(store.ledger, store.payments, codes, ids, clock, calendar, rates),
    updatePayment: new PaymentUpdater(finder, store.ledger, store.payments, ids, clock, calendar, rates),
    confirmPayment: new PaymentConfirmer(finder, store.ledger, store.posting, rates, clock, calendar),
    cancelPayment: new PaymentCanceller(store.posting, store.creditNotes, clock),
    searchPayments: new PaymentSearcher(store.payments, store.ledger, store.creditNotes),
    createCreditNote: new SupplierCreditNoteCreator(store.creditNotes, store.ledger, codes, ids, clock, calendar, rates),
    updateCreditNote: new SupplierCreditNoteUpdater(store.creditNotes, store.ledger, ids, clock, calendar, rates),
    confirmCreditNote: new SupplierCreditNoteConfirmer(store.creditNotePosting, clock, calendar),
    cancelCreditNote: new SupplierCreditNoteCanceller(store.creditNotePosting, clock),
    searchCreditNotes: new SupplierCreditNoteSearcher(store.creditNotes, store.ledger),
    availableCredits: new SupplierAvailableCreditsFinder(store.creditNotes, store.ledger),
  };
}

export type PayablesScenario = ReturnType<typeof aPayablesScenario>;
