import { ConflictError } from '../../../../shared/domain/domain.error.js';

// Si el unico administrador pudiera desactivarse, la empresa se quedaria sin nadie
// capaz de devolverle el acceso.
export class CannotDeactivateSelfError extends ConflictError {
  constructor() {
    super('You cannot deactivate your own membership.');
  }
}
