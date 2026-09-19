import { Uuid } from '../../../../shared/domain/uuid.vo.js';

// La bodega vive en el catalogo, pero su identificador entra por aqui: envolverlo es lo que
// impide que un texto cualquiera llegue crudo a la consulta y vuelva como error interno.
export class WarehouseRef extends Uuid {
  static of(value: string): WarehouseRef {
    return new WarehouseRef(value);
  }
}
