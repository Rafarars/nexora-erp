import { Uuid } from '../../../../shared/domain/uuid.vo.js';

// Propio del contexto: los reportes no importan nada de los modulos que leen.
export class TenantId extends Uuid {
  static of(value: string): TenantId {
    return new TenantId(value);
  }
}
