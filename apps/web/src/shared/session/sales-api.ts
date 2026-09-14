import 'server-only';
import { HttpSalesApi } from '@/modules/sales/infrastructure/http-sales-api';
import { getEnv } from '@/env';

let cached: HttpSalesApi | null = null;

export function salesApi(): HttpSalesApi {
  cached ??= new HttpSalesApi(getEnv().API_URL);

  return cached;
}
