import { Module } from '@nestjs/common';
import { BUSINESS_CALENDAR } from '../../../shared/domain/ports/business-calendar.js';
import type { BusinessCalendar } from '../../../shared/domain/ports/business-calendar.js';
import { CLOCK } from '../../../shared/domain/ports/clock.js';
import type { Clock } from '../../../shared/domain/ports/clock.js';
import { DOCUMENT_RATES } from '../../../shared/domain/ports/document-rates.js';
import type { DocumentRates } from '../../../shared/domain/ports/document-rates.js';
import { ID_GENERATOR } from '../../../shared/domain/ports/id-generator.js';
import type { IdGenerator } from '../../../shared/domain/ports/id-generator.js';
import { CompanyModule } from '../../company/infrastructure/company.module.js';
import { SharedModule } from '../../../shared/infrastructure/shared.module.js';
import { PrismaModule } from '../../../shared/prisma/prisma.module.js';

import { CancelPaymentPutController } from './http/cancel-payment-put.controller.js';
import { ConfirmPaymentPutController } from './http/confirm-payment-put.controller.js';
import { CreatePaymentPostController } from './http/create-payment-post.controller.js';
import { SearchPaymentsGetController } from './http/search-payments-get.controller.js';
import { UpdatePaymentPutController } from './http/update-payment-put.controller.js';
import { SearchPayableInvoicesGetController } from './http/search-payable-invoices-get.controller.js';
import { SearchSupplierBalancesGetController } from './http/search-supplier-balances-get.controller.js';
import { SearchSupplierStatementGetController } from './http/search-supplier-statement-get.controller.js';
import { CreateSupplierCreditNotePostController } from './http/create-credit-note-post.controller.js';
import { UpdateSupplierCreditNotePutController } from './http/update-credit-note-put.controller.js';
import { ConfirmSupplierCreditNotePutController } from './http/confirm-credit-note-put.controller.js';
import { CancelSupplierCreditNotePutController } from './http/cancel-credit-note-put.controller.js';
import { FindSupplierCreditNoteGetController } from './http/find-credit-note-get.controller.js';
import { SearchSupplierCreditNotesGetController } from './http/search-credit-notes-get.controller.js';
import { SupplierAvailableCreditsGetController } from './http/supplier-available-credits-get.controller.js';
import { EligiblePurchaseReturnsGetController } from './http/eligible-purchase-returns-get.controller.js';

import { PaymentCanceller } from '../application/cancel-payment/payment-canceller.js';
import { PaymentConfirmer } from '../application/confirm-payment/payment-confirmer.js';
import { PaymentCreator } from '../application/create-payment/payment-creator.js';
import { PaymentSearcher } from '../application/search-payments/payment-searcher.js';
import { PaymentUpdater } from '../application/update-payment/payment-updater.js';
import { PayableInvoiceSearcher } from '../application/search-invoices/payable-invoice-searcher.js';
import { SupplierBalanceSearcher } from '../application/search-supplier-balances/supplier-balance-searcher.js';
import { SupplierStatementSearcher } from '../application/search-supplier-statement/supplier-statement-searcher.js';
import { SupplierCreditNoteCreator } from '../application/create-credit-note/supplier-credit-note-creator.js';
import { SupplierCreditNoteUpdater } from '../application/update-credit-note/supplier-credit-note-updater.js';
import { SupplierCreditNoteConfirmer } from '../application/confirm-credit-note/supplier-credit-note-confirmer.js';
import { SupplierCreditNoteCanceller } from '../application/cancel-credit-note/supplier-credit-note-canceller.js';
import { SupplierCreditNoteSearcher } from '../application/search-credit-notes/supplier-credit-note-searcher.js';
import { SupplierAvailableCreditsFinder } from '../application/supplier-available-credits/supplier-available-credits-finder.js';
import { EligiblePurchaseReturnsSearcher } from '../application/search-eligible-returns/eligible-purchase-returns-searcher.js';

import { PAYABLES_LEDGER } from '../domain/ledger/payables-ledger.js';
import type { PayablesLedger } from '../domain/ledger/payables-ledger.js';
import { PaymentFinder } from '../domain/payment/find/payment-finder.js';
import { SUPPLIER_PAYMENT_REPOSITORY } from '../domain/payment/payment.repository.js';
import type { SupplierPaymentRepository } from '../domain/payment/payment.repository.js';
import { SUPPLIER_PAYMENT_POSTING } from '../domain/payment/posting/supplier-payment-posting.js';
import type { SupplierPaymentPosting } from '../domain/payment/posting/supplier-payment-posting.js';
import { SUPPLIER_CREDIT_NOTE_REPOSITORY } from '../domain/credit-note/supplier-credit-note.repository.js';
import type { SupplierCreditNoteRepository } from '../domain/credit-note/supplier-credit-note.repository.js';
import { SUPPLIER_CREDIT_NOTE_POSTING } from '../domain/credit-note/posting/supplier-credit-note-posting.js';
import type { SupplierCreditNotePosting } from '../domain/credit-note/posting/supplier-credit-note-posting.js';
import { PAYABLES_CODE_SEQUENCE } from '../domain/shared/code-sequence.js';
import type { PayablesCodeSequence } from '../domain/shared/code-sequence.js';

import { PrismaPayablesCodeSequence } from './persistence/prisma-payables-code-sequence.js';
import { PrismaPayablesLedger } from './persistence/prisma-payables-ledger.js';
import { PrismaSupplierPaymentPosting } from './persistence/prisma-supplier-payment-posting.js';
import { PrismaSupplierPaymentRepository } from './persistence/prisma-supplier-payment.repository.js';
import { PrismaSupplierCreditNoteRepository } from './persistence/prisma-supplier-credit-note.repository.js';
import { PrismaSupplierCreditNotePosting } from './persistence/prisma-supplier-credit-note-posting.js';
import { InventoryModule } from '../../inventory/infrastructure/inventory.module.js';
import { PAYABLE_BALANCES } from '../../../shared/prisma/payable-balances.js';
import { PrismaPayableBalances } from './persistence/prisma-payable-balances.js';

@Module({
  imports: [PrismaModule, SharedModule, CompanyModule, InventoryModule],
  controllers: [
    SearchPaymentsGetController,
    CreatePaymentPostController,
    UpdatePaymentPutController,
    ConfirmPaymentPutController,
    CancelPaymentPutController,
    SearchPayableInvoicesGetController,
    SearchSupplierBalancesGetController,
    SearchSupplierStatementGetController,
    CreateSupplierCreditNotePostController,
    UpdateSupplierCreditNotePutController,
    ConfirmSupplierCreditNotePutController,
    CancelSupplierCreditNotePutController,
    FindSupplierCreditNoteGetController,
    SearchSupplierCreditNotesGetController,
    SupplierAvailableCreditsGetController,
    EligiblePurchaseReturnsGetController,
  ],
  providers: [
    { provide: SUPPLIER_PAYMENT_REPOSITORY, useClass: PrismaSupplierPaymentRepository },
    { provide: SUPPLIER_PAYMENT_POSTING, useClass: PrismaSupplierPaymentPosting },
    { provide: PAYABLES_LEDGER, useClass: PrismaPayablesLedger },
    { provide: PAYABLES_CODE_SEQUENCE, useClass: PrismaPayablesCodeSequence },
    { provide: SUPPLIER_CREDIT_NOTE_REPOSITORY, useClass: PrismaSupplierCreditNoteRepository },
    { provide: SUPPLIER_CREDIT_NOTE_POSTING, useClass: PrismaSupplierCreditNotePosting },
    { provide: PAYABLE_BALANCES, useClass: PrismaPayableBalances },

    {
      provide: PaymentFinder,
      useFactory: (r: SupplierPaymentRepository) => new PaymentFinder(r),
      inject: [SUPPLIER_PAYMENT_REPOSITORY],
    },
    {
      provide: PaymentCreator,
      useFactory: (
        l: PayablesLedger,
        r: SupplierPaymentRepository,
        c: PayablesCodeSequence,
        i: IdGenerator,
        k: Clock,
        cal: BusinessCalendar,
        dr: DocumentRates,
      ) => new PaymentCreator(l, r, c, i, k, cal, dr),
      inject: [PAYABLES_LEDGER, SUPPLIER_PAYMENT_REPOSITORY, PAYABLES_CODE_SEQUENCE, ID_GENERATOR, CLOCK, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: PaymentUpdater,
      useFactory: (
        f: PaymentFinder,
        l: PayablesLedger,
        r: SupplierPaymentRepository,
        i: IdGenerator,
        k: Clock,
        cal: BusinessCalendar,
        dr: DocumentRates,
      ) => new PaymentUpdater(f, l, r, i, k, cal, dr),
      inject: [PaymentFinder, PAYABLES_LEDGER, SUPPLIER_PAYMENT_REPOSITORY, ID_GENERATOR, CLOCK, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: PaymentConfirmer,
      useFactory: (
        f: PaymentFinder,
        l: PayablesLedger,
        p: SupplierPaymentPosting,
        dr: DocumentRates,
        k: Clock,
        cal: BusinessCalendar,
      ) => new PaymentConfirmer(f, l, p, dr, k, cal),
      inject: [PaymentFinder, PAYABLES_LEDGER, SUPPLIER_PAYMENT_POSTING, DOCUMENT_RATES, CLOCK, BUSINESS_CALENDAR],
    },
    {
      provide: PaymentCanceller,
      useFactory: (p: SupplierPaymentPosting, cn: SupplierCreditNoteRepository, k: Clock) => new PaymentCanceller(p, cn, k),
      inject: [SUPPLIER_PAYMENT_POSTING, SUPPLIER_CREDIT_NOTE_REPOSITORY, CLOCK],
    },
    {
      provide: PaymentSearcher,
      useFactory: (r: SupplierPaymentRepository, l: PayablesLedger, cn: SupplierCreditNoteRepository) => new PaymentSearcher(r, l, cn),
      inject: [SUPPLIER_PAYMENT_REPOSITORY, PAYABLES_LEDGER, SUPPLIER_CREDIT_NOTE_REPOSITORY],
    },
    {
      provide: PayableInvoiceSearcher,
      useFactory: (l: PayablesLedger, cal: BusinessCalendar, dr: DocumentRates) => new PayableInvoiceSearcher(l, cal, dr),
      inject: [PAYABLES_LEDGER, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: SupplierBalanceSearcher,
      useFactory: (l: PayablesLedger, cal: BusinessCalendar, dr: DocumentRates) => new SupplierBalanceSearcher(l, cal, dr),
      inject: [PAYABLES_LEDGER, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: SupplierStatementSearcher,
      useFactory: (l: PayablesLedger, r: SupplierPaymentRepository, cal: BusinessCalendar, dr: DocumentRates) =>
        new SupplierStatementSearcher(l, r, cal, dr),
      inject: [PAYABLES_LEDGER, SUPPLIER_PAYMENT_REPOSITORY, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: SupplierCreditNoteCreator,
      useFactory: (
        cn: SupplierCreditNoteRepository,
        l: PayablesLedger,
        c: PayablesCodeSequence,
        i: IdGenerator,
        k: Clock,
        cal: BusinessCalendar,
        dr: DocumentRates,
      ) => new SupplierCreditNoteCreator(cn, l, c, i, k, cal, dr),
      inject: [SUPPLIER_CREDIT_NOTE_REPOSITORY, PAYABLES_LEDGER, PAYABLES_CODE_SEQUENCE, ID_GENERATOR, CLOCK, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: SupplierCreditNoteUpdater,
      useFactory: (
        cn: SupplierCreditNoteRepository,
        l: PayablesLedger,
        i: IdGenerator,
        k: Clock,
        cal: BusinessCalendar,
        dr: DocumentRates,
      ) => new SupplierCreditNoteUpdater(cn, l, i, k, cal, dr),
      inject: [SUPPLIER_CREDIT_NOTE_REPOSITORY, PAYABLES_LEDGER, ID_GENERATOR, CLOCK, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: SupplierCreditNoteConfirmer,
      useFactory: (p: SupplierCreditNotePosting, k: Clock, cal: BusinessCalendar) =>
        new SupplierCreditNoteConfirmer(p, k, cal),
      inject: [SUPPLIER_CREDIT_NOTE_POSTING, CLOCK, BUSINESS_CALENDAR],
    },
    {
      provide: SupplierCreditNoteCanceller,
      useFactory: (p: SupplierCreditNotePosting, k: Clock) => new SupplierCreditNoteCanceller(p, k),
      inject: [SUPPLIER_CREDIT_NOTE_POSTING, CLOCK],
    },
    {
      provide: SupplierCreditNoteSearcher,
      useFactory: (cn: SupplierCreditNoteRepository, l: PayablesLedger) => new SupplierCreditNoteSearcher(cn, l),
      inject: [SUPPLIER_CREDIT_NOTE_REPOSITORY, PAYABLES_LEDGER],
    },
    {
      provide: SupplierAvailableCreditsFinder,
      useFactory: (cn: SupplierCreditNoteRepository, l: PayablesLedger) => new SupplierAvailableCreditsFinder(cn, l),
      inject: [SUPPLIER_CREDIT_NOTE_REPOSITORY, PAYABLES_LEDGER],
    },
    {
      provide: EligiblePurchaseReturnsSearcher,
      useFactory: (cn: SupplierCreditNoteRepository, l: PayablesLedger) => new EligiblePurchaseReturnsSearcher(cn, l),
      inject: [SUPPLIER_CREDIT_NOTE_REPOSITORY, PAYABLES_LEDGER],
    },
  ],
  exports: [
    SUPPLIER_PAYMENT_REPOSITORY,
    SUPPLIER_PAYMENT_POSTING,
    PAYABLES_LEDGER,
    PAYABLES_CODE_SEQUENCE,
    SUPPLIER_CREDIT_NOTE_REPOSITORY,
    SUPPLIER_CREDIT_NOTE_POSTING,
    PayableInvoiceSearcher,
    SupplierBalanceSearcher,
    SupplierStatementSearcher,
    SupplierCreditNoteSearcher,
    SupplierAvailableCreditsFinder,
    EligiblePurchaseReturnsSearcher,
    PAYABLE_BALANCES,
  ],
})
export class PayablesModule {}
