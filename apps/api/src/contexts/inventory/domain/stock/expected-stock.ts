import { WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export const EXPECTED_STOCK = Symbol('ExpectedStock');

// Lo que va a entrar y salir sin haberse movido todavia: lo que los pedidos confirmados tienen
// reservado y lo que las ordenes de compra confirmadas traen en camino, por articulo y bodega y
// en unidad base. Los documentos son de otros contextos y el adaptador lee sus tablas, como ya
// hace el kardex con los codigos de sus documentos.
export interface ExpectedQuantity {
  itemId: string;
  warehouseId: string;
  reserved: number;
  incoming: number;
}

export interface ExpectedStock {
  pending(tenantId: TenantId, warehouseId?: WarehouseRef): Promise<ExpectedQuantity[]>;
}
