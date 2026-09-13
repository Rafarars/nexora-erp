import 'server-only';
import { HttpCatalogApi } from '@/modules/catalog/infrastructure/http-catalog-api';
import { getEnv } from '@/env';

let cached: HttpCatalogApi | null = null;

export function catalogApi(): HttpCatalogApi {
  cached ??= new HttpCatalogApi(getEnv().API_URL);

  return cached;
}
