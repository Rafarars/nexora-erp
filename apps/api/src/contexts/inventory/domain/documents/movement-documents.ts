import { MovementOriginType } from '../movement/inventory-movement.entity.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export const MOVEMENT_DOCUMENTS = Symbol('MovementDocuments');

export interface DocumentRef {
  type: MovementOriginType;
  id: string;
}

// El codigo legible de los documentos que aparecen en el kardex. Los ajustes son del
// inventario; las entradas son de compras, y el adaptador las lee de sus tablas.
export interface MovementDocuments {
  codesOf(tenantId: TenantId, documents: DocumentRef[]): Promise<Map<string, string>>;
}
