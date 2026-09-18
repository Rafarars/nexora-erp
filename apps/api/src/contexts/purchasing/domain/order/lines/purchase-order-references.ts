import { IdGenerator } from '../../../../../shared/domain/ports/id-generator.js';
import { PurchasingCatalog } from '../../catalog/purchasing-catalog.js';
import {
  InactivePurchaseItemError,
  InactivePurchaseWarehouseError,
  InactiveSupplierError,
  InvalidPurchaseQuantityError,
  PurchaseItemNotFoundError,
  PurchaseUnitNotOfItemError,
  PurchaseWarehouseNotFoundError,
  ItemNotPurchasableError,
  ServiceNotPurchasableError,
} from '../../errors/purchasing.errors.js';
import { TaxRate, UnitCost } from '../../shared/money.js';
import { Quantity } from '../../shared/quantity.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { SupplierFinder } from '../../supplier/find/supplier-finder.js';
import { SupplierId } from '../../supplier/supplier.entity.js';
import { PurchaseOrderLine, PurchaseOrderLineId } from '../purchase-order-line.js';

export interface PurchaseOrderLineInput {
  // Solo al revalidar un borrador: conserva la identidad de la linea.
  id?: string;
  itemId: string;
  unitId: string;
  quantity: number;
  unitCost: number;
}

// Convierte lo que escribe una persona en referencias validas: proveedor y bodega activos
// de su empresa, articulos activos e inventariables, la unidad es del articulo, la cantidad
// convertida a unidad base con el factor de HOY y el impuesto copiado del articulo.
export class PurchaseOrderReferences {
  constructor(
    private readonly suppliers: SupplierFinder,
    private readonly catalog: PurchasingCatalog,
    private readonly ids: IdGenerator,
  ) {}

  async supplier(tenantId: TenantId, supplierId: string): Promise<SupplierId> {
    const supplier = await this.suppliers.find(tenantId, SupplierId.of(supplierId));

    if (!supplier.isActive()) throw new InactiveSupplierError(supplier.id.value);

    return supplier.id;
  }

  async warehouse(tenantId: TenantId, warehouseId: string): Promise<WarehouseRef> {
    const ref = WarehouseRef.of(warehouseId);
    const [warehouse] = await this.catalog.findWarehouses(tenantId, [ref]);

    if (!warehouse) throw new PurchaseWarehouseNotFoundError(ref.value);
    if (!warehouse.isActive) throw new InactivePurchaseWarehouseError(ref.value);

    return ref;
  }

  async lines(tenantId: TenantId, inputs: PurchaseOrderLineInput[]): Promise<PurchaseOrderLine[]> {
    const refs = [...new Set(inputs.map((input) => input.itemId))].map((id) => ItemRef.of(id));
    const items = await this.catalog.findItems(tenantId, refs);

    return inputs.map((input, index) => {
      const item = items.find((candidate) => candidate.id === input.itemId);

      if (!item) throw new PurchaseItemNotFoundError(input.itemId);
      if (!item.isActive) throw new InactivePurchaseItemError(item.id);
      if (item.type === 'service') throw new ServiceNotPurchasableError(item.id);
      if (!item.isPurchasable) throw new ItemNotPurchasableError(item.id);

      const unitId = UnitRef.of(input.unitId);
      const unit = item.units.find((candidate) => candidate.unitId === unitId.value);

      if (!unit) throw new PurchaseUnitNotOfItemError(unitId.value, item.id);

      const quantity = Quantity.of(input.quantity);
      const baseQuantity = quantity.times(unit.conversionFactor);

      // Cero, o tan pequeno que al convertir se redondea a cero, no pide nada.
      if (quantity.isZero() || baseQuantity.isZero()) throw new InvalidPurchaseQuantityError(input.quantity);

      return PurchaseOrderLine.of({
        id: PurchaseOrderLineId.of(input.id ?? this.ids.next()),
        lineNumber: index + 1,
        itemId: ItemRef.of(item.id),
        itemSku: item.sku,
        itemName: item.name,
        unitId,
        quantity,
        baseQuantity,
        unitCost: UnitCost.of(input.unitCost),
        taxRate: TaxRate.of(item.taxRate),
      });
    });
  }
}
