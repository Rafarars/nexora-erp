import { ExpectedQuantity, ExpectedStock } from '../../domain/stock/expected-stock.js';
import { WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Las pruebas declaran lo que los pedidos reservaron y lo que las ordenes traen, sin montar
// compras ni ventas para ello.
export class InMemoryExpectedStock implements ExpectedStock {
  constructor(readonly rows: (ExpectedQuantity & { tenantId: string })[] = []) {}

  add(row: ExpectedQuantity & { tenantId: string }): void {
    const current = this.rows.find((candidate) => candidate.tenantId === row.tenantId && candidate.itemId === row.itemId && candidate.warehouseId === row.warehouseId);

    if (!current) return void this.rows.push({ ...row });

    current.reserved += row.reserved;
    current.incoming += row.incoming;
  }

  async pending(tenantId: TenantId, warehouseId?: WarehouseRef): Promise<ExpectedQuantity[]> {
    return this.rows
      .filter((row) => row.tenantId === tenantId.value)
      .filter((row) => !warehouseId || row.warehouseId === warehouseId.value)
      .map(({ itemId, warehouseId: warehouse, reserved, incoming }) => ({ itemId, warehouseId: warehouse, reserved, incoming }));
  }
}
