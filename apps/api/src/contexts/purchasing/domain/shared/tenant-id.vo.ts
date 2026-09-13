import { Uuid } from '../../../../shared/domain/uuid.vo.js';

// Propio del contexto: compras no importa nada de access, del catalogo ni del inventario.
export class TenantId extends Uuid {
  static of(value: string): TenantId {
    return new TenantId(value);
  }
}
