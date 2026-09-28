import { Uuid } from '../../../../shared/domain/uuid.vo.js';

// Propio del contexto: cuentas por pagar no importa nada de ventas, compras ni de access.
export class TenantId extends Uuid {
  static of(value: string): TenantId {
    return new TenantId(value);
  }
}
