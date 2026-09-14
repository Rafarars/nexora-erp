import 'server-only';
import { HttpReceivablesApi } from '@/modules/receivables/infrastructure/http-receivables-api';
import { getEnv } from '@/env';

let cached: HttpReceivablesApi | null = null;

export function receivablesApi(): HttpReceivablesApi {
  cached ??= new HttpReceivablesApi(getEnv().API_URL);

  return cached;
}
