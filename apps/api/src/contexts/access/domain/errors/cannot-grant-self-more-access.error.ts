import { ConflictError } from '../../../../shared/domain/domain.error.js';

// Quien reparte roles podia darse a si mismo el que lo concede todo: el permiso de asignar
// valia por todos los demas. Nadie se concede lo que no tiene.
export class CannotGrantSelfMoreAccessError extends ConflictError {
  constructor() {
    super(
      'You cannot grant yourself more access than you already have.',
      'You cannot give yourself permissions you do not already have. Ask another administrator.',
    );
  }
}
