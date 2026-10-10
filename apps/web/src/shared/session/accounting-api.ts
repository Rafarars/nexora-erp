import 'server-only';
import { HttpAccountingApi } from '@/modules/accounting/infrastructure/http-accounting-api';
import { getEnv } from '@/env';

let cached: HttpAccountingApi | null = null;

export function accountingApi(): HttpAccountingApi {
  cached ??= new HttpAccountingApi(getEnv().API_URL);

  return cached;
}
