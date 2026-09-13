import { Uuid } from '../../../../shared/domain/uuid.vo.js';

// Propio del contexto y no importado de `access`: un contexto no depende de otro.
// Los dos hablan de la misma empresa por su identificador, que viaja en la sesion.
export class TenantId extends Uuid {
  static of(value: string): TenantId {
    return new TenantId(value);
  }
}
