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

// El mundo de una prueba de aplicacion de cuentas por cobrar: clientes y facturas que en la base
// escribe ventas, reloj congelado y sin base de datos ni NestJS.
export function aReceivablesScenario() {
  const clock = new FixedClock(NOW);
  const ids = new SequentialIdGenerator();
  const store = new InMemoryReceivablesStore();
  const codes = new InMemoryReceivablesCodeSequence();
  const finder = new PaymentFinder(store.payments);

  return {
    clock,
    store,
    codes,
    createPayment: new PaymentCreator(store.ledger, store.payments, codes, ids, clock),
    updatePayment: new PaymentUpdater(finder, store.ledger, store.payments, ids, clock),
    confirmPayment: new PaymentConfirmer(store.posting, clock),
    cancelPayment: new PaymentCanceller(store.posting, clock),
    searchPayments: new PaymentSearcher(store.payments, store.ledger),
    searchReceivables: new ReceivableSearcher(store.ledger, clock),
    searchCustomerBalances: new CustomerBalanceSearcher(store.ledger, clock),
    searchCustomerStatement: new CustomerStatementSearcher(store.ledger, store.payments, clock),
  };
}

export type ReceivablesScenario = ReturnType<typeof aReceivablesScenario>;
