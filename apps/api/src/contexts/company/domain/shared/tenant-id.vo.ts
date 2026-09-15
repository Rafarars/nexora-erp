import { Uuid } from '../../../../shared/domain/uuid.vo.js';

// Propio del contexto: la empresa no importa nada de access.
export class TenantId extends Uuid {
  static of(value: string): TenantId {
    return new TenantId(value);
  }
}
