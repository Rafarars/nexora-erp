import { Uuid } from '../../../../shared/domain/uuid.vo.js';

// Referencias por identificador. El articulo y la bodega que usa un ajuste se preguntan por el
// puerto InventoryCatalog; la categoria, el impuesto y las unidades de un articulo viven en el
// catalogo y se preguntan por CatalogReferences.
export class ItemRef extends Uuid {
  static of(value: string): ItemRef {
    return new ItemRef(value);
  }
}

export class WarehouseRef extends Uuid {
  static of(value: string): WarehouseRef {
    return new WarehouseRef(value);
  }
}

export class UnitRef extends Uuid {
  static of(value: string): UnitRef {
    return new UnitRef(value);
  }
}

export class CategoryRef extends Uuid {
  static of(value: string): CategoryRef {
    return new CategoryRef(value);
  }
}

export class TaxRef extends Uuid {
  static of(value: string): TaxRef {
    return new TaxRef(value);
  }
}

export class PriceListRef extends Uuid {
  static of(value: string): PriceListRef {
    return new PriceListRef(value);
  }
}
