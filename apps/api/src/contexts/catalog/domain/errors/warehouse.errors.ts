import { ConflictError } from '../../../../shared/domain/domain.error.js';

// Los documentos sugeriran la bodega por defecto: una empresa con bodegas activas
// nunca puede quedarse sin ella.
export class DefaultWarehouseDeactivationError extends ConflictError {
  constructor(id: string) {
    super(
      `Warehouse <${id}> is the default one and cannot be deactivated.`,
      'The default warehouse cannot be deactivated. Choose another default first.',
    );
  }
}

// Dos personas eligiendo a la vez la bodega por defecto de una empresa: la base deja
// pasar solo a una, y a la otra se le dice que lo intente de nuevo.
export class ConcurrentDefaultWarehouseError extends ConflictError {
  constructor(tenantId: string) {
    super(
      `Another warehouse became the default one of tenant <${tenantId}> at the same time.`,
      'Another warehouse became the default one at the same time. Try again.',
    );
  }
}

export class InactiveDefaultWarehouseError extends ConflictError {
  constructor(id: string) {
    super(
      `Warehouse <${id}> is inactive and cannot be the default one.`,
      'An inactive warehouse cannot be the default one.',
    );
  }
}
