import 'server-only';
import { HttpAccessApi } from '@/modules/access/infrastructure/http-access-api';
import { getEnv } from '@/env';

// Una sola instancia por proceso: el adaptador no guarda estado, solo la URL base.
let cached: HttpAccessApi | null = null;

export function accessApi(): HttpAccessApi {
  cached ??= new HttpAccessApi(getEnv().API_URL);

  return cached;
}
