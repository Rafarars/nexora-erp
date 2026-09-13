import 'server-only';
import { HttpPurchasingApi } from '@/modules/purchasing/infrastructure/http-purchasing-api';
import { getEnv } from '@/env';

let cached: HttpPurchasingApi | null = null;

export function purchasingApi(): HttpPurchasingApi {
  cached ??= new HttpPurchasingApi(getEnv().API_URL);

  return cached;
}
