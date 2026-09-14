import 'server-only';
import { HttpReportsApi } from '@/modules/reports/infrastructure/http-reports-api';
import { getEnv } from '@/env';

let cached: HttpReportsApi | null = null;

export function reportsApi(): HttpReportsApi {
  cached ??= new HttpReportsApi(getEnv().API_URL);

  return cached;
}
