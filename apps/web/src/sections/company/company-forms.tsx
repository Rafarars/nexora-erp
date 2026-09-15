'use client';

import { useActionState } from 'react';
import { saveCompanyProfile, saveCompanySettings } from '@/app/(app)/administracion/empresa/actions';
import { Field, FormError, SubmitButton } from '@/sections/shared/field';
import { AMOUNT_DECIMALS_MAX, PRICE_DECIMALS_MAX, currencyOptions } from '@/modules/company/domain/company';
import type { CompanyProfile, CompanySettings, Currency } from '@/modules/company/domain/company';
import { emptyState } from '@/shared/forms/form-state';

export function CompanyForms({
  profile,
  settings,
  currencies,
  timeZones,
  canEditProfile,
  canEditSettings,
}: {
  profile: CompanyProfile | null;
  settings: CompanySettings;
  currencies: Currency[];
  timeZones: string[];
  canEditProfile: boolean;
  canEditSettings: boolean;
}) {
  const [profileState, submitProfile, savingProfile] = useActionState(saveCompanyProfile, emptyState);
  const [settingsState, submitSettings, savingSettings] = useActionState(saveCompanySettings, emptyState);
  const offered = currencyOptions(currencies, settings.baseCurrency.code, settings.secondaryCurrency?.code);

  return (
    <div className="max-w-xl space-y-10">
      {profile ? (
        <section className="space-y-4" data-testid="company-profile-section">
          <div>
            <h2 className="text-base font-medium">Datos de la empresa</h2>
            <p className="text-muted mt-1 text-sm">Lo que sale en la cabecera de los reportes y los documentos.</p>
          </div>

          {canEditProfile ? (
            <form action={submitProfile} className="space-y-4">
              <Field label="Razón social" name="legalName" testId="company-legal-name" defaultValue={profile.legalName} autoComplete="organization" />
              <Field label="Nombre comercial" name="tradeName" required={false} testId="company-trade-name" defaultValue={profile.tradeName ?? ''} autoComplete="off" />
              <Field label="RIF" name="fiscalId" required={false} testId="company-fiscal-id" defaultValue={profile.fiscalId ?? ''} autoComplete="off" />
              <Field label="Dirección" name="address" required={false} testId="company-address" defaultValue={profile.address ?? ''} autoComplete="street-address" />
              <Field label="Teléfono" name="phone" required={false} testId="company-phone" defaultValue={profile.phone ?? ''} autoComplete="tel" />
              <Field label="Correo" name="email" type="email" required={false} testId="company-email" defaultValue={profile.email ?? ''} autoComplete="email" />

              <FormError message={profileState.error} testId="company-profile-error" />
              {profileState.done ? (
                <p className="text-sm text-emerald-600" data-testid="company-profile-saved">
                  Datos guardados.
                </p>
              ) : null}

              <SubmitButton pending={savingProfile} testId="company-profile-submit">
                Guardar datos
              </SubmitButton>
            </form>
          ) : (
            <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm" data-testid="company-profile-readonly">
              <Row label="Razón social" value={profile.legalName} />
              <Row label="Nombre comercial" value={profile.tradeName} />
              <Row label="RIF" value={profile.fiscalId} />
              <Row label="Dirección" value={profile.address} />
              <Row label="Teléfono" value={profile.phone} />
              <Row label="Correo" value={profile.email} />
            </dl>
          )}
        </section>
      ) : null}

      <section className="space-y-4" data-testid="company-settings-section">
        <div>
          <h2 className="text-base font-medium">Parámetros</h2>
          <p className="text-muted mt-1 text-sm">
            La moneda en que la empresa lleva sus cifras, la que la acompaña, su zona horaria y los decimales. Hoy, para la
            empresa, es <span data-testid="company-today">{settings.today}</span>.
          </p>
        </div>

        {canEditSettings ? (
          <form action={submitSettings} className="space-y-4">
            <Select label="Moneda principal" name="baseCurrency" testId="company-base-currency" defaultValue={settings.baseCurrency.code}>
              {offered.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.name} ({currency.code})
                </option>
              ))}
            </Select>
            <Select label="Moneda secundaria" name="secondaryCurrency" testId="company-secondary-currency" defaultValue={settings.secondaryCurrency?.code ?? ''}>
              <option value="">Ninguna</option>
              {offered.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.name} ({currency.code})
                </option>
              ))}
            </Select>
            <Select label="Zona horaria" name="timeZone" testId="company-time-zone" defaultValue={settings.timeZone}>
              {timeZones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
            <Field label={`Decimales de los importes (0 a ${AMOUNT_DECIMALS_MAX})`} name="amountDecimals" testId="company-amount-decimals" defaultValue={String(settings.amountDecimals)} inputMode="numeric" />
            <Field label={`Decimales de los precios (0 a ${PRICE_DECIMALS_MAX})`} name="priceDecimals" testId="company-price-decimals" defaultValue={String(settings.priceDecimals)} inputMode="numeric" />

            <FormError message={settingsState.error} testId="company-settings-error" />
            {settingsState.done ? (
              <p className="text-sm text-emerald-600" data-testid="company-settings-saved">
                Parámetros guardados.
              </p>
            ) : null}

            <SubmitButton pending={savingSettings} testId="company-settings-submit">
              Guardar parámetros
            </SubmitButton>
          </form>
        ) : (
          <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm" data-testid="company-settings-readonly">
            <Row label="Moneda principal" value={`${settings.baseCurrency.name} (${settings.baseCurrency.code})`} />
            <Row label="Moneda secundaria" value={settings.secondaryCurrency ? `${settings.secondaryCurrency.name} (${settings.secondaryCurrency.code})` : null} />
            <Row label="Zona horaria" value={settings.timeZone} />
            <Row label="Decimales" value={`Importes ${settings.amountDecimals} · precios ${settings.priceDecimals}`} />
          </dl>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd>{value ?? '—'}</dd>
    </>
  );
}

function Select({ label, name, testId, defaultValue, children }: { label: string; name: string; testId: string; defaultValue: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue} data-testid={testId} className="border-line bg-background w-full rounded-md border px-3 py-2 text-sm">
        {children}
      </select>
    </div>
  );
}
