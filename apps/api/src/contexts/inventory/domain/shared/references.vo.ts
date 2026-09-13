import { Uuid } from '../../../../shared/domain/uuid.vo.js';

// Referencias a lo que vive en el catalogo. El inventario solo guarda el identificador y
// pregunta lo demas por su puerto InventoryCatalog.
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
