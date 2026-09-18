import { Uuid } from '../../../../shared/domain/uuid.vo.js';

// Referencias a lo que vive en el catalogo. Compras solo guarda el identificador y pregunta
// lo demas por su puerto SalesCatalog.
export class ItemRef extends Uuid {
  static of(value: string): ItemRef {
    return new ItemRef(value);
  }
}

export class UnitRef extends Uuid {
  static of(value: string): UnitRef {
    return new UnitRef(value);
  }
}

export class WarehouseRef extends Uuid {
  static of(value: string): WarehouseRef {
    return new WarehouseRef(value);
  }
}

export class PriceListRef extends Uuid {
  static of(value: string): PriceListRef {
    return new PriceListRef(value);
  }
}
