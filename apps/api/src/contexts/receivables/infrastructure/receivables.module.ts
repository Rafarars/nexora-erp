import { DOCUMENT_RATES } from '../../../shared/domain/ports/document-rates.js';
import type { DocumentRates } from '../../../shared/domain/ports/document-rates.js';
import { BUSINESS_CALENDAR } from '../../../shared/domain/ports/business-calendar.js';
import type { BusinessCalendar } from '../../../shared/domain/ports/business-calendar.js';
import { Module } from '@nestjs/common';
import type { Clock } from '../../../shared/domain/ports/clock.js';
import { CLOCK } from '../../../shared/domain/ports/clock.js';
import type { IdGenerator } from '../../../shared/domain/ports/id-generator.js';
import { ID_GENERATOR } from '../../../shared/domain/ports/id-generator.js';
import { CompanyModule } from '../../company/infrastructure/company.module.js';
import { SharedModule } from '../../../shared/infrastructure/shared.module.js';
import { PrismaModule } from '../../../shared/prisma/prisma.module.js';
import { RECEIVABLE_BALANCES } from '../../../shared/prisma/receivable-balances.js';
import { PaymentCanceller } from '../application/cancel-payment/payment-canceller.js';
import { PaymentConfirmer } from '../application/confirm-payment/payment-confirmer.js';
import { PaymentCreator } from '../application/create-payment/payment-creator.js';
import { CustomerBalanceSearcher } from '../application/search-customer-balances/customer-balance-searcher.js';
import { CustomerStatementSearcher } from '../application/search-customer-statement/customer-statement-searcher.js';
import { PaymentSearcher } from '../application/search-payments/payment-searcher.js';
import { ReceivableSearcher } from '../application/search-receivables/receivable-searcher.js';
import { PaymentUpdater } from '../application/update-payment/payment-updater.js';
import { RECEIVABLES_LEDGER } from '../domain/ledger/receivables-ledger.js';
import type { ReceivablesLedger } from '../domain/ledger/receivables-ledger.js';
import { PaymentFinder } from '../domain/payment/find/payment-finder.js';
import { PAYMENT_REPOSITORY } from '../domain/payment/payment.repository.js';
import type { PaymentRepository } from '../domain/payment/payment.repository.js';
import { PAYMENT_POSTING } from '../domain/payment/posting/payment-posting.js';
import type { PaymentPosting } from '../domain/payment/posting/payment-posting.js';
import { RECEIVABLES_CODE_SEQUENCE } from '../domain/shared/code-sequence.js';
import type { ReceivablesCodeSequence } from '../domain/shared/code-sequence.js';
import { CancelPaymentPutController } from './http/cancel-payment-put.controller.js';
import { ConfirmPaymentPutController } from './http/confirm-payment-put.controller.js';
import { CreatePaymentPostController } from './http/create-payment-post.controller.js';
import { SearchCustomerBalancesGetController } from './http/search-customer-balances-get.controller.js';
import { SearchCustomerStatementGetController } from './http/search-customer-statement-get.controller.js';
import { SearchPaymentsGetController } from './http/search-payments-get.controller.js';
import { SearchReceivablesGetController } from './http/search-receivables-get.controller.js';
import { UpdatePaymentPutController } from './http/update-payment-put.controller.js';
import { PrismaPaymentPosting } from './persistence/prisma-payment-posting.js';
import { PrismaPaymentRepository } from './persistence/prisma-payment.repository.js';
import { PrismaReceivableBalances } from './persistence/prisma-receivable-balances.js';
import { PrismaReceivablesCodeSequence } from './persistence/prisma-receivables-code-sequence.js';
import { PrismaReceivablesLedger } from './persistence/prisma-receivables-ledger.js';

// El cableado de cuentas por cobrar. No importa ventas: lee sus tablas por su propio adaptador.
// Exporta RECEIVABLE_BALANCES, lo que ventas necesita para facturar a credito y anular.
@Module({
  imports: [PrismaModule, SharedModule, CompanyModule],
  controllers: [
    SearchPaymentsGetController,
    CreatePaymentPostController,
    UpdatePaymentPutController,
    ConfirmPaymentPutController,
    CancelPaymentPutController,
    SearchReceivablesGetController,
    SearchCustomerBalancesGetController,
    SearchCustomerStatementGetController,
  ],
  providers: [
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
    { provide: PAYMENT_POSTING, useClass: PrismaPaymentPosting },
    { provide: RECEIVABLES_LEDGER, useClass: PrismaReceivablesLedger },
    { provide: RECEIVABLES_CODE_SEQUENCE, useClass: PrismaReceivablesCodeSequence },
    { provide: RECEIVABLE_BALANCES, useClass: PrismaReceivableBalances },

    { provide: PaymentFinder, useFactory: (r: PaymentRepository) => new PaymentFinder(r), inject: [PAYMENT_REPOSITORY] },
    {
      provide: PaymentCreator,
      useFactory: (l: ReceivablesLedger, r: PaymentRepository, c: ReceivablesCodeSequence, i: IdGenerator, k: Clock, cal: BusinessCalendar, dr: DocumentRates) => new PaymentCreator(l, r, c, i, k, cal, dr),
      inject: [RECEIVABLES_LEDGER, PAYMENT_REPOSITORY, RECEIVABLES_CODE_SEQUENCE, ID_GENERATOR, CLOCK, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: PaymentUpdater,
      useFactory: (f: PaymentFinder, l: ReceivablesLedger, r: PaymentRepository, i: IdGenerator, k: Clock, cal: BusinessCalendar, dr: DocumentRates) => new PaymentUpdater(f, l, r, i, k, cal, dr),
      inject: [PaymentFinder, RECEIVABLES_LEDGER, PAYMENT_REPOSITORY, ID_GENERATOR, CLOCK, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: PaymentConfirmer,
      useFactory: (f: PaymentFinder, l: ReceivablesLedger, p: PaymentPosting, dr: DocumentRates, k: Clock, cal: BusinessCalendar) => new PaymentConfirmer(f, l, p, dr, k, cal),
      inject: [PaymentFinder, RECEIVABLES_LEDGER, PAYMENT_POSTING, DOCUMENT_RATES, CLOCK, BUSINESS_CALENDAR],
    },
    { provide: PaymentCanceller, useFactory: (p: PaymentPosting, k: Clock) => new PaymentCanceller(p, k), inject: [PAYMENT_POSTING, CLOCK] },
    { provide: PaymentSearcher, useFactory: (r: PaymentRepository, l: ReceivablesLedger) => new PaymentSearcher(r, l), inject: [PAYMENT_REPOSITORY, RECEIVABLES_LEDGER] },
    {
      provide: ReceivableSearcher,
      useFactory: (l: ReceivablesLedger, cal: BusinessCalendar, dr: DocumentRates) => new ReceivableSearcher(l, cal, dr),
      inject: [RECEIVABLES_LEDGER, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: CustomerBalanceSearcher,
      useFactory: (l: ReceivablesLedger, cal: BusinessCalendar, dr: DocumentRates) => new CustomerBalanceSearcher(l, cal, dr),
      inject: [RECEIVABLES_LEDGER, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: CustomerStatementSearcher,
      useFactory: (l: ReceivablesLedger, r: PaymentRepository, cal: BusinessCalendar, dr: DocumentRates) => new CustomerStatementSearcher(l, r, cal, dr),
      inject: [RECEIVABLES_LEDGER, PAYMENT_REPOSITORY, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
  ],
  exports: [RECEIVABLE_BALANCES],
})
export class ReceivablesModule {}
