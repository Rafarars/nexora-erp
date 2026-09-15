import 'server-only';
import { HttpCompanyApi } from '@/modules/company/infrastructure/http-company-api';
import { getEnv } from '@/env';

let cached: HttpCompanyApi | null = null;

export function companyApi(): HttpCompanyApi {
  cached ??= new HttpCompanyApi(getEnv().API_URL);

  return cached;
}
