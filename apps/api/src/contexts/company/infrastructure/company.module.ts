import { Module } from '@nestjs/common';
import { BUSINESS_CALENDAR } from '../../../shared/domain/ports/business-calendar.js';
import { DOCUMENT_RATES } from '../../../shared/domain/ports/document-rates.js';
import type { Clock } from '../../../shared/domain/ports/clock.js';
import { CLOCK } from '../../../shared/domain/ports/clock.js';
import type { IdGenerator } from '../../../shared/domain/ports/id-generator.js';
import { ID_GENERATOR } from '../../../shared/domain/ports/id-generator.js';
import { SharedModule } from '../../../shared/infrastructure/shared.module.js';
import { PrismaModule } from '../../../shared/prisma/prisma.module.js';
import { ExchangeRateStatusChanger } from '../application/change-exchange-rate-status/exchange-rate-status-changer.js';
import { ExchangeRateRecorder } from '../application/record-exchange-rate/exchange-rate-recorder.js';
import { CompanyProfileSearcher } from '../application/search-company-profile/company-profile-searcher.js';
import { CompanySettingsSearcher } from '../application/search-company-settings/company-settings-searcher.js';
import { CurrencySearcher } from '../application/search-currencies/currency-searcher.js';
import { ExchangeRateSearcher } from '../application/search-exchange-rates/exchange-rate-searcher.js';
import { CompanyProfileUpdater } from '../application/update-company-profile/company-profile-updater.js';
import { CompanySettingsUpdater } from '../application/update-company-settings/company-settings-updater.js';
import { CURRENCY_CATALOG } from '../domain/currency/currency-catalog.js';
import type { CurrencyCatalog } from '../domain/currency/currency-catalog.js';
import { COMPANY_PROFILE_REPOSITORY } from '../domain/profile/company-profile.repository.js';
import type { CompanyProfileRepository } from '../domain/profile/company-profile.repository.js';
import { CompanyProfileFinder } from '../domain/profile/find/company-profile-finder.js';
import { CompanyDocumentRates } from '../domain/rate/document/company-document-rates.js';
import { EXCHANGE_RATE_REPOSITORY } from '../domain/rate/exchange-rate.repository.js';
import type { ExchangeRateRepository } from '../domain/rate/exchange-rate.repository.js';
import { ExchangeRateFinder } from '../domain/rate/find/exchange-rate-finder.js';
import { RateCurrencyPolicy } from '../domain/rate/policy/rate-currency-policy.js';
import { RateResolver } from '../domain/rate/resolve/rate-resolver.js';
import { TENANT_NAMES } from '../domain/profile/tenant-names.js';
import type { TenantNames } from '../domain/profile/tenant-names.js';
import { CompanyCalendar } from '../domain/settings/calendar/company-calendar.js';
import { COMPANY_SETTINGS_REPOSITORY } from '../domain/settings/company-settings.repository.js';
import type { CompanySettingsRepository } from '../domain/settings/company-settings.repository.js';
import { CompanySettingsFinder } from '../domain/settings/find/company-settings-finder.js';
import { COMPANY_ACTIVITY } from '../domain/settings/policy/company-activity.js';
import type { CompanyActivity } from '../domain/settings/policy/company-activity.js';
import { CurrencyPolicy } from '../domain/settings/policy/currency-policy.js';
import { ChangeExchangeRateStatusPutController } from './http/change-exchange-rate-status-put.controller.js';
import { RecordExchangeRatePutController } from './http/record-exchange-rate-put.controller.js';
import { SearchCompanyProfileGetController } from './http/search-company-profile-get.controller.js';
import { SearchCompanySettingsGetController } from './http/search-company-settings-get.controller.js';
import { SearchCurrenciesGetController } from './http/search-currencies-get.controller.js';
import { SearchExchangeRatesGetController } from './http/search-exchange-rates-get.controller.js';
import { UpdateCompanyProfilePutController } from './http/update-company-profile-put.controller.js';
import { UpdateCompanySettingsPutController } from './http/update-company-settings-put.controller.js';
import { PrismaCompanyActivity } from './persistence/prisma-company-activity.js';
import { PrismaCompanyProfileRepository } from './persistence/prisma-company-profile.repository.js';
import { PrismaCompanySettingsRepository } from './persistence/prisma-company-settings.repository.js';
import { PrismaCurrencyCatalog } from './persistence/prisma-currency-catalog.js';
import { PrismaExchangeRateRepository } from './persistence/prisma-exchange-rate.repository.js';
import { PrismaTenantNames } from './persistence/prisma-tenant-names.js';

// El cableado de la empresa: sus datos, sus parametros, el catalogo de monedas y las tasas de cambio.
// Exporta lo que otros contextos le piden: el calendario y las tasas de un documento.
@Module({
  imports: [PrismaModule, SharedModule],
  controllers: [
    SearchCompanyProfileGetController,
    UpdateCompanyProfilePutController,
    SearchCompanySettingsGetController,
    UpdateCompanySettingsPutController,
    SearchCurrenciesGetController,
    SearchExchangeRatesGetController,
    RecordExchangeRatePutController,
    ChangeExchangeRateStatusPutController,
  ],
  providers: [
    { provide: COMPANY_SETTINGS_REPOSITORY, useClass: PrismaCompanySettingsRepository },
    { provide: COMPANY_PROFILE_REPOSITORY, useClass: PrismaCompanyProfileRepository },
    { provide: CURRENCY_CATALOG, useClass: PrismaCurrencyCatalog },
    { provide: TENANT_NAMES, useClass: PrismaTenantNames },
    { provide: COMPANY_ACTIVITY, useClass: PrismaCompanyActivity },
    { provide: EXCHANGE_RATE_REPOSITORY, useClass: PrismaExchangeRateRepository },

    { provide: CompanySettingsFinder, useFactory: (r: CompanySettingsRepository) => new CompanySettingsFinder(r), inject: [COMPANY_SETTINGS_REPOSITORY] },
    {
      provide: CompanyProfileFinder,
      useFactory: (r: CompanyProfileRepository, n: TenantNames) => new CompanyProfileFinder(r, n),
      inject: [COMPANY_PROFILE_REPOSITORY, TENANT_NAMES],
    },
    {
      provide: CurrencyPolicy,
      useFactory: (c: CurrencyCatalog, a: CompanyActivity) => new CurrencyPolicy(c, a),
      inject: [CURRENCY_CATALOG, COMPANY_ACTIVITY],
    },
    { provide: ExchangeRateFinder, useFactory: (r: ExchangeRateRepository) => new ExchangeRateFinder(r), inject: [EXCHANGE_RATE_REPOSITORY] },
    { provide: RateCurrencyPolicy, useFactory: (c: CurrencyCatalog) => new RateCurrencyPolicy(c), inject: [CURRENCY_CATALOG] },
    { provide: RateResolver, useFactory: (r: ExchangeRateRepository) => new RateResolver(r), inject: [EXCHANGE_RATE_REPOSITORY] },
    {
      provide: DOCUMENT_RATES,
      useFactory: (f: CompanySettingsFinder, r: RateResolver) => new CompanyDocumentRates(f, r),
      inject: [CompanySettingsFinder, RateResolver],
    },
    { provide: BUSINESS_CALENDAR, useFactory: (f: CompanySettingsFinder, k: Clock) => new CompanyCalendar(f, k), inject: [CompanySettingsFinder, CLOCK] },

    { provide: CompanyProfileSearcher, useFactory: (f: CompanyProfileFinder) => new CompanyProfileSearcher(f), inject: [CompanyProfileFinder] },
    {
      provide: CompanyProfileUpdater,
      useFactory: (f: CompanyProfileFinder, r: CompanyProfileRepository, k: Clock) => new CompanyProfileUpdater(f, r, k),
      inject: [CompanyProfileFinder, COMPANY_PROFILE_REPOSITORY, CLOCK],
    },
    {
      provide: CompanySettingsSearcher,
      useFactory: (f: CompanySettingsFinder, c: CurrencyCatalog, k: Clock) => new CompanySettingsSearcher(f, c, k),
      inject: [CompanySettingsFinder, CURRENCY_CATALOG, CLOCK],
    },
    {
      provide: CompanySettingsUpdater,
      useFactory: (f: CompanySettingsFinder, p: CurrencyPolicy, r: CompanySettingsRepository, k: Clock) => new CompanySettingsUpdater(f, p, r, k),
      inject: [CompanySettingsFinder, CurrencyPolicy, COMPANY_SETTINGS_REPOSITORY, CLOCK],
    },
    { provide: CurrencySearcher, useFactory: (c: CurrencyCatalog) => new CurrencySearcher(c), inject: [CURRENCY_CATALOG] },
    {
      provide: ExchangeRateSearcher,
      useFactory: (r: ExchangeRateRepository, v: RateResolver, f: CompanySettingsFinder, c: CurrencyCatalog, k: Clock) => new ExchangeRateSearcher(r, v, f, c, k),
      inject: [EXCHANGE_RATE_REPOSITORY, RateResolver, CompanySettingsFinder, CURRENCY_CATALOG, CLOCK],
    },
    {
      provide: ExchangeRateRecorder,
      useFactory: (r: ExchangeRateRepository, p: RateCurrencyPolicy, i: IdGenerator, k: Clock) => new ExchangeRateRecorder(r, p, i, k),
      inject: [EXCHANGE_RATE_REPOSITORY, RateCurrencyPolicy, ID_GENERATOR, CLOCK],
    },
    {
      provide: ExchangeRateStatusChanger,
      useFactory: (f: ExchangeRateFinder, r: ExchangeRateRepository, k: Clock) => new ExchangeRateStatusChanger(f, r, k),
      inject: [ExchangeRateFinder, EXCHANGE_RATE_REPOSITORY, CLOCK],
    },
  ],
  exports: [BUSINESS_CALENDAR, DOCUMENT_RATES],
})
export class CompanyModule {}
