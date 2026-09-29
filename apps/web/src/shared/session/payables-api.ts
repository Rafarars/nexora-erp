import 'server-only';
import { HttpPayablesApi } from '@/modules/payables/infrastructure/http-payables-api';
import { getEnv } from '@/env';

let cached: HttpPayablesApi | null = null;

export function payablesApi(): HttpPayablesApi {
  cached ??= new HttpPayablesApi(getEnv().API_URL);

  return cached;
}
