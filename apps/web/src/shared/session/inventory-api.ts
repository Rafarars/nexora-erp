import 'server-only';
import { HttpInventoryApi } from '@/modules/inventory/infrastructure/http-inventory-api';
import { getEnv } from '@/env';

let cached: HttpInventoryApi | null = null;

export function inventoryApi(): HttpInventoryApi {
  cached ??= new HttpInventoryApi(getEnv().API_URL);

  return cached;
}
