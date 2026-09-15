import { FixedClock } from '../../../../shared/infrastructure/testing/fixed-clock.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { CompanyProfileFinder } from '../../domain/profile/find/company-profile-finder.js';
import { CompanyDocumentRates } from '../../domain/rate/document/company-document-rates.js';
import { ExchangeRateFinder } from '../../domain/rate/find/exchange-rate-finder.js';
import { RateCurrencyPolicy } from '../../domain/rate/policy/rate-currency-policy.js';
import { RateResolver } from '../../domain/rate/resolve/rate-resolver.js';
import { CompanyCalendar } from '../../domain/settings/calendar/company-calendar.js';
import { CompanySettingsFinder } from '../../domain/settings/find/company-settings-finder.js';
import { CurrencyPolicy } from '../../domain/settings/policy/currency-policy.js';
import { CURRENCIES, NOW, RETIRED_CURRENCY, TENANT_A, TENANT_B } from '../../domain/testing/company.mother.js';
import { InMemoryCompanyActivity } from '../../infrastructure/testing/in-memory-company-activity.js';
import { InMemoryCompanyProfileRepository } from '../../infrastructure/testing/in-memory-company-profile.repository.js';
import { InMemoryCompanySettingsRepository } from '../../infrastructure/testing/in-memory-company-settings.repository.js';
import { InMemoryCurrencyCatalog } from '../../infrastructure/testing/in-memory-currency-catalog.js';
import { InMemoryExchangeRateRepository } from '../../infrastructure/testing/in-memory-exchange-rate.repository.js';
import { InMemoryTenantNames } from '../../infrastructure/testing/in-memory-tenant-names.js';

// El mundo de una prueba de la empresa: dos empresas registradas, las monedas de la migracion mas
// una retirada, sin tasas, y el reloj congelado.
export function aCompanyScenario() {
  const clock = new FixedClock(NOW);
  const settings = new InMemoryCompanySettingsRepository();
  const profiles = new InMemoryCompanyProfileRepository();
  const currencies = new InMemoryCurrencyCatalog([...CURRENCIES, RETIRED_CURRENCY]);
  const activity = new InMemoryCompanyActivity();
  const settingsFinder = new CompanySettingsFinder(settings);
  const rates = new InMemoryExchangeRateRepository();
  const resolver = new RateResolver(rates);

  return {
    clock,
    settings,
    profiles,
    currencies,
    activity,
    settingsFinder,
    profileFinder: new CompanyProfileFinder(profiles, new InMemoryTenantNames({ [TENANT_A]: 'Acme Industrial', [TENANT_B]: 'Globex Servicios' })),
    policy: new CurrencyPolicy(currencies, activity),
    calendar: new CompanyCalendar(settingsFinder, clock),
    ids: new SequentialIdGenerator(),
    rates,
    rateFinder: new ExchangeRateFinder(rates),
    ratePolicy: new RateCurrencyPolicy(currencies),
    resolver,
    documentRates: new CompanyDocumentRates(settingsFinder, resolver, currencies),
  };
}

export type CompanyScenario = ReturnType<typeof aCompanyScenario>;
