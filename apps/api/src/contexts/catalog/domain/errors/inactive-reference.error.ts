import { ConflictError } from '../../../../shared/domain/domain.error.js';

// Un articulo nuevo no puede nacer apuntando a algo que ya no se ofrece.
export class InactiveReferenceError extends ConflictError {
  constructor(kind: string, id: string) {
    super(
      `${kind} <${id}> is inactive and cannot be assigned.`,
      'The item refers to a record that is inactive.',
    );
  }
}
