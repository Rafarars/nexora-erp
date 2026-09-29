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
    cancelPayment: new PaymentCanceller(store.posting, clock),
    searchPayments: new PaymentSearcher(store.payments, store.ledger),
  };
}

export type PayablesScenario = ReturnType<typeof aPayablesScenario>;
