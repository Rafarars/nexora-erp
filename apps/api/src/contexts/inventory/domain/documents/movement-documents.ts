import { MovementOriginType } from '../movement/inventory-movement.entity.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export const MOVEMENT_DOCUMENTS = Symbol('MovementDocuments');

export type DocumentOriginType =
  | MovementOriginType
  | 'purchase_invoice'
  | 'supplier_credit_note';

export interface DocumentRef {
  type: DocumentOriginType;
  id: string;
}

// El codigo legible de los documentos que aparecen en el kardex o en los ajustes.
export interface MovementDocuments {
  codesOf(tenantId: TenantId, documents: DocumentRef[]): Promise<Map<string, string>>;
}
