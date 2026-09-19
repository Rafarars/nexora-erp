import { Uuid } from '../../../../shared/domain/uuid.vo.js';

// El cliente vive en ventas, pero su identificador entra por aqui: envolverlo es lo que impide
// que un texto cualquiera llegue crudo a la consulta y vuelva como error interno.
export class CustomerRef extends Uuid {
  static of(value: string): CustomerRef {
    return new CustomerRef(value);
  }
}
