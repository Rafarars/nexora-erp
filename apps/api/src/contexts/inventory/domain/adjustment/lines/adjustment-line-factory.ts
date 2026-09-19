import { IdGenerator } from '../../../../../shared/domain/ports/id-generator.js';
import { InventoryCatalog, StockableItem } from '../../catalog/inventory-catalog.js';
import {
  CostOnOutgoingLineError,
  InvalidDirectionError,
  InactiveStockItemError,
  FractionalQuantityError,
  InactiveStockWarehouseError,
  InvalidQuantityError,
  MissingRevaluationCostError,
  ServiceHasNoStockError,
  StockItemNotFoundError,
  StockWarehouseNotFoundError,
  UnitNotOfItemError,
} from '../../errors/inventory.errors.js';
import { StockDirection } from '../../movement/inventory-movement.entity.js';
import { Quantity } from '../../quantity/quantity.vo.js';
import { UnitCost } from '../../quantity/unit-cost.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { AdjustmentLine, AdjustmentLineId } from '../adjustment-line.js';
import { AdjustmentType, isRevaluation } from '../adjustment.entity.js';

export interface AdjustmentLineInput {
  itemId: string;
  unitId?: string;
  direction?: string;
  quantity?: number;
  unitCost?: number | null;
}

// Convierte lo que escribe una persona en lineas validas: todo lo que usan existe en su
// empresa, esta activo y es inventariable, la unidad es del articulo y la cantidad queda
// convertida a la unidad base con el factor que el articulo tiene HOY.
export class AdjustmentLineFactory {
  constructor(
    private readonly catalog: InventoryCatalog,
    private readonly ids: IdGenerator,
  ) {}

  async warehouse(tenantId: TenantId, warehouseId: string): Promise<WarehouseRef> {
    const ref = WarehouseRef.of(warehouseId);
    const [warehouse] = await this.catalog.findWarehouses(tenantId, [ref]);

    if (!warehouse) throw new StockWarehouseNotFoundError(ref.value);
    if (!warehouse.isActive) throw new InactiveStockWarehouseError(ref.value);

    return ref;
  }

  async lines(tenantId: TenantId, inputs: AdjustmentLineInput[], type: AdjustmentType): Promise<AdjustmentLine[]> {
    const refs = [...new Set(inputs.map((input) => input.itemId))].map((id) => ItemRef.of(id));
    const items = await this.catalog.findItems(tenantId, refs);

    return inputs.map((input, index) => {
      const lineNumber = index + 1;
      const item = items.find((candidate) => candidate.id === input.itemId);

      if (!item) throw new StockItemNotFoundError(input.itemId);
      if (!item.isActive) throw new InactiveStockItemError(item.id);
      if (item.type === 'service') throw new ServiceHasNoStockError(item.id);

      // Revaluar no mueve cantidad: reexpresa lo que vale todo lo que hay, en unidad base y al
      // costo nuevo, que aqui es obligatorio. Cuanto hay se sabe al publicar, no al escribirlo.
      if (isRevaluation(type)) return this.revaluationLine(lineNumber, item, input);

      const direction = directionOf(input.direction ?? '');
      // Se busca por el texto antes de construir la referencia: una unidad que el articulo no
      // tiene se explica mejor asi que con un error de formato de identificador.
      const unit = item.units.find((candidate) => candidate.unitId === input.unitId);

      if (!unit) throw new UnitNotOfItemError(input.unitId ?? '', item.id);

      const unitId = UnitRef.of(unit.unitId);

      const quantity = Quantity.of(input.quantity ?? 0);

      if (unit.mustBeWhole && !quantity.isWhole()) throw new FractionalQuantityError(quantity.toNumber(), unit.abbreviation);

      const baseQuantity = quantity.times(unit.conversionFactor);

      // Cero, o tan pequeno que al convertir se redondea a cero, no mueve nada.
      if (quantity.isZero() || baseQuantity.isZero()) throw new InvalidQuantityError(quantity.toNumber());

      const hasCost = input.unitCost !== undefined && input.unitCost !== null;

      if (hasCost && direction === 'out') throw new CostOnOutgoingLineError(lineNumber);

      return AdjustmentLine.of({
        id: AdjustmentLineId.of(this.ids.next()),
        lineNumber,
        itemId: ItemRef.of(item.id),
        itemSku: item.sku,
        itemName: item.name,
        unitId,
        direction,
        quantity,
        baseQuantity,
        unitCost: hasCost ? UnitCost.of(input.unitCost as number) : null,
      });
    });
  }

  // La linea de una revaluacion: el articulo, su unidad base y el costo nuevo. La cantidad
  // queda en cero porque no se mueve ninguna; la que se revalora es la que haya al publicar.
  private revaluationLine(lineNumber: number, item: StockableItem, input: AdjustmentLineInput): AdjustmentLine {
    const base = item.units.find((unit) => unit.isBase);

    if (!base) throw new UnitNotOfItemError(input.unitId ?? '', item.id);
    if (input.unitCost === undefined || input.unitCost === null) throw new MissingRevaluationCostError(lineNumber);

    return AdjustmentLine.of({
      id: AdjustmentLineId.of(this.ids.next()),
      lineNumber,
      itemId: ItemRef.of(item.id),
      itemSku: item.sku,
      itemName: item.name,
      unitId: UnitRef.of(base.unitId),
      direction: 'in',
      quantity: Quantity.zero(),
      baseQuantity: Quantity.zero(),
      unitCost: UnitCost.of(input.unitCost),
    });
  }
}

function directionOf(value: string): StockDirection {
  if (value !== 'in' && value !== 'out') {
    throw new InvalidDirectionError(value);
  }

  return value;
}

