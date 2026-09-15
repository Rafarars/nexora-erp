import { can } from '@/modules/access/domain/session';
import { timeZoneOptions } from '@/modules/company/domain/company';
import { CompanyForms } from '@/sections/company/company-forms';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Las zonas que conoce el entorno donde corre el servidor, las mismas que valida la API.
const knownTimeZones = () => (Intl as unknown as { supportedValuesOf(key: 'timeZone'): string[] }).supportedValuesOf('timeZone');

export default async function CompanyPage() {
  const { session, token } = await requireSession();
  const canSeeProfile = can(session, 'company.profile.search');
  const canEditSettings = can(session, 'company.settings.update');

  if (!canSeeProfile && !canEditSettings) {
    return (
      <p className="text-muted text-sm" data-testid="company-forbidden">
        Tu rol no tiene permiso para ver la configuración de esta empresa.
      </p>
    );
  }

  const api = companyApi();
  const [profile, settings, currencies] = await Promise.all([canSeeProfile ? api.profile(token) : null, api.settings(token), api.currencies(token)]);

  return (
    <CompanyForms
      profile={profile}
      settings={settings}
      currencies={currencies}
      timeZones={timeZoneOptions(knownTimeZones(), settings.timeZone)}
      canEditProfile={can(session, 'company.profile.update')}
      canEditSettings={canEditSettings}
    />
  );
}
