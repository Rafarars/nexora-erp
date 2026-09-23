import { FixedDocumentRates } from '../../../../shared/infrastructure/testing/fixed-document-rates.js';
import { ClockBusinessCalendar } from '../../../../shared/infrastructure/testing/clock-business-calendar.js';
import { FixedClock } from '../../../../shared/infrastructure/testing/fixed-clock.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { PaymentFinder } from '../../domain/payment/find/payment-finder.js';
import { NOW } from '../../domain/testing/receivables.mother.js';
import { InMemoryReceivablesCodeSequence } from '../../infrastructure/testing/in-memory-receivables-code-sequence.js';
import { InMemoryReceivablesStore } from '../../infrastructure/testing/in-memory-receivables-store.js';
import { PaymentCanceller } from '../cancel-payment/payment-canceller.js';
import { PaymentConfirmer } from '../confirm-payment/payment-confirmer.js';
import { PaymentCreator } from '../create-payment/payment-creator.js';
import { CustomerBalanceSearcher } from '../search-customer-balances/customer-balance-searcher.js';
import { CustomerStatementSearcher } from '../search-customer-statement/customer-statement-searcher.js';
import { PaymentSearcher } from '../search-payments/payment-searcher.js';
import { ReceivableSearcher } from '../search-receivables/receivable-searcher.js';
import { PaymentUpdater } from '../update-payment/payment-updater.js';
import { CreditNoteCreator } from '../create-credit-note/credit-note-creator.js';
import { CreditNoteUpdater } from '../update-credit-note/credit-note-updater.js';
import { CreditNoteConfirmer } from '../confirm-credit-note/credit-note-confirmer.js';
import { CreditNoteCanceller } from '../cancel-credit-note/credit-note-canceller.js';
import { CreditNoteSearcher } from '../search-credit-notes/credit-note-searcher.js';
import { CustomerAvailableCreditsFinder } from '../customer-available-credits/customer-available-credits-finder.js';

// El mundo de una prueba de aplicacion de cuentas por cobrar: clientes y facturas que en la base
// escribe ventas, reloj congelado y sin base de datos ni NestJS.
export function aReceivablesScenario() {
  const clock = new FixedClock(NOW);
  const calendar = new ClockBusinessCalendar(clock);
  const ids = new SequentialIdGenerator();
  const store = new InMemoryReceivablesStore();
  const codes = new InMemoryReceivablesCodeSequence();
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
    searchReceivables: new ReceivableSearcher(store.ledger, calendar, rates),
    searchCustomerBalances: new CustomerBalanceSearcher(store.ledger, calendar, rates),
    searchCustomerStatement: new CustomerStatementSearcher(store.ledger, store.payments, calendar, rates, store.creditNotes),
    createCreditNote: new CreditNoteCreator(store.creditNotes, store.ledger, codes, ids, clock, calendar, rates),
    updateCreditNote: new CreditNoteUpdater(store.creditNotes, store.ledger, ids, clock, calendar, rates),
    confirmCreditNote: new CreditNoteConfirmer(store.creditNotePosting, clock, calendar),
    cancelCreditNote: new CreditNoteCanceller(store.creditNotePosting, clock),
    searchCreditNotes: new CreditNoteSearcher(store.creditNotes, store.ledger),
    availableCredits: new CustomerAvailableCreditsFinder(store.creditNotes, store.ledger),
  };
}

export type ReceivablesScenario = ReturnType<typeof aReceivablesScenario>;
