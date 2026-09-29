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

import { PaymentCanceller } from '../application/cancel-payment/payment-canceller.js';
import { PaymentConfirmer } from '../application/confirm-payment/payment-confirmer.js';
import { PaymentCreator } from '../application/create-payment/payment-creator.js';
import { PaymentSearcher } from '../application/search-payments/payment-searcher.js';
import { PaymentUpdater } from '../application/update-payment/payment-updater.js';

import { PAYABLES_LEDGER } from '../domain/ledger/payables-ledger.js';
import type { PayablesLedger } from '../domain/ledger/payables-ledger.js';
import { PaymentFinder } from '../domain/payment/find/payment-finder.js';
import { SUPPLIER_PAYMENT_REPOSITORY } from '../domain/payment/payment.repository.js';
import type { SupplierPaymentRepository } from '../domain/payment/payment.repository.js';
import { SUPPLIER_PAYMENT_POSTING } from '../domain/payment/posting/supplier-payment-posting.js';
import type { SupplierPaymentPosting } from '../domain/payment/posting/supplier-payment-posting.js';
import { PAYABLES_CODE_SEQUENCE } from '../domain/shared/code-sequence.js';
import type { PayablesCodeSequence } from '../domain/shared/code-sequence.js';

import { CancelPaymentPutController } from './http/cancel-payment-put.controller.js';
import { ConfirmPaymentPutController } from './http/confirm-payment-put.controller.js';
import { CreatePaymentPostController } from './http/create-payment-post.controller.js';
import { SearchPaymentsGetController } from './http/search-payments-get.controller.js';
import { UpdatePaymentPutController } from './http/update-payment-put.controller.js';

import { PrismaPayablesCodeSequence } from './persistence/prisma-payables-code-sequence.js';
import { PrismaPayablesLedger } from './persistence/prisma-payables-ledger.js';
import { PrismaSupplierPaymentPosting } from './persistence/prisma-supplier-payment-posting.js';
import { PrismaSupplierPaymentRepository } from './persistence/prisma-supplier-payment.repository.js';

@Module({
  imports: [PrismaModule, SharedModule, CompanyModule],
  controllers: [
    SearchPaymentsGetController,
    CreatePaymentPostController,
    UpdatePaymentPutController,
    ConfirmPaymentPutController,
    CancelPaymentPutController,
  ],
  providers: [
    { provide: SUPPLIER_PAYMENT_REPOSITORY, useClass: PrismaSupplierPaymentRepository },
    { provide: SUPPLIER_PAYMENT_POSTING, useClass: PrismaSupplierPaymentPosting },
    { provide: PAYABLES_LEDGER, useClass: PrismaPayablesLedger },
    { provide: PAYABLES_CODE_SEQUENCE, useClass: PrismaPayablesCodeSequence },

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
      useFactory: (p: SupplierPaymentPosting, k: Clock) => new PaymentCanceller(p, k),
      inject: [SUPPLIER_PAYMENT_POSTING, CLOCK],
    },
    {
      provide: PaymentSearcher,
      useFactory: (r: SupplierPaymentRepository, l: PayablesLedger) => new PaymentSearcher(r, l),
      inject: [SUPPLIER_PAYMENT_REPOSITORY, PAYABLES_LEDGER],
    },
  ],
  exports: [
    SUPPLIER_PAYMENT_REPOSITORY,
    SUPPLIER_PAYMENT_POSTING,
    PAYABLES_LEDGER,
    PAYABLES_CODE_SEQUENCE,
  ],
})
export class PayablesModule {}
