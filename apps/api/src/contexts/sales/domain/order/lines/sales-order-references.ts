import { IdGenerator } from '../../../../../shared/domain/ports/id-generator.js';
import { SalesCatalog } from '../../catalog/sales-catalog.js';
import { CustomerFinder } from '../../customer/find/customer-finder.js';
import { CustomerId } from '../../customer/customer.entity.js';
import {
  InactiveCustomerError,
  InactiveSalesItemError,
  InactiveSalesWarehouseError,
  InvalidSalesQuantityError,
  SalesItemNotFoundError,
  SalesUnitNotOfItemError,
  SalesWarehouseNotFoundError,
  ItemNotSellableError,
  MissingSalesPriceError,
  ServiceNotSellableError,
} from '../../errors/sales.errors.js';
import { TaxRate, UnitPrice } from '../../shared/money.js';
import { Quantity } from '../../shared/quantity.vo.js';
import { ItemRef, PriceListRef, UnitRef, WarehouseRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { SalesPricing } from '../pricing/sales-pricing.js';
import { SalesOrderLine, SalesOrderLineId } from '../sales-order-line.js';

export interface SalesOrderLineInput {
  // Solo al revalidar un borrador: conserva la identidad de la linea.
  id?: string;
  itemId: string;
  unitId: string;
  quantity: number;
  // Sin precio, manda el de la lista. La pantalla lo rellena, pero el servidor lo vuelve a
  // resolver: fiarse del formulario es lo que deja al companero sin revalidacion.
  unitPrice?: number | null;
}

// Convierte lo que escribe una persona en referencias validas: cliente y bodega activos de su
// empresa, articulos activos e inventariables, la unidad es del articulo, la cantidad convertida
// a unidad base con el factor de HOY y el impuesto copiado del articulo.
export class SalesOrderReferences {
  constructor(
    private readonly customers: CustomerFinder,
    private readonly catalog: SalesCatalog,
    private readonly ids: IdGenerator,
  ) {}

  // Devuelve tambien su lista: es una condicion comercial del cliente, y el pedido la arrastra.
  async customer(tenantId: TenantId, customerId: string): Promise<{ id: CustomerId; priceListId: PriceListRef | null }> {
    const customer = await this.customers.find(tenantId, CustomerId.of(customerId));

    if (!customer.isActive()) throw new InactiveCustomerError(customer.id.value);

    return { id: customer.id, priceListId: customer.priceListId() };
  }

  async warehouse(tenantId: TenantId, warehouseId: string): Promise<WarehouseRef> {
    const ref = WarehouseRef.of(warehouseId);
    const [warehouse] = await this.catalog.findWarehouses(tenantId, [ref]);

    if (!warehouse) throw new SalesWarehouseNotFoundError(ref.value);
    if (!warehouse.isActive) throw new InactiveSalesWarehouseError(ref.value);

    return ref;
  }

  async lines(tenantId: TenantId, inputs: SalesOrderLineInput[], pricing: SalesPricing): Promise<SalesOrderLine[]> {
    const refs = [...new Set(inputs.map((input) => input.itemId))].map((id) => ItemRef.of(id));
    const items = await this.catalog.findItems(tenantId, refs);

    return inputs.map((input, index) => {
      const item = items.find((candidate) => candidate.id === input.itemId);

      if (!item) throw new SalesItemNotFoundError(input.itemId);
      if (!item.isActive) throw new InactiveSalesItemError(item.id);
      if (item.type === 'service') throw new ServiceNotSellableError(item.id);
      if (!item.isSellable) throw new ItemNotSellableError(item.id);

      const unitId = UnitRef.of(input.unitId);
      const unit = item.units.find((candidate) => candidate.unitId === unitId.value);

      if (!unit) throw new SalesUnitNotOfItemError(unitId.value, item.id);

      const quantity = Quantity.of(input.quantity);
      const baseQuantity = quantity.times(unit.conversionFactor);
      const listPrice = pricing.suggest(item, unit.conversionFactor);
      const unitPrice = input.unitPrice === null || input.unitPrice === undefined ? listPrice : UnitPrice.of(input.unitPrice);

      if (!unitPrice) throw new MissingSalesPriceError(item.id);

      pricing.ensureAboveMinimum(item, unitPrice);

      if (quantity.isZero() || baseQuantity.isZero()) throw new InvalidSalesQuantityError(input.quantity);

      return SalesOrderLine.of({
        id: SalesOrderLineId.of(input.id ?? this.ids.next()),
        lineNumber: index + 1,
        itemId: ItemRef.of(item.id),
        itemSku: item.sku,
        itemName: item.name,
        unitId,
        quantity,
        baseQuantity,
        unitPrice,
        listPrice: listPrice ?? unitPrice,
        taxRate: TaxRate.of(item.taxRate),
      });
    });
  }
}
