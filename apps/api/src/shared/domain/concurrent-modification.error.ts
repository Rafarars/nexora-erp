import { ConflictError } from './domain.error.js';

// Dos personas con el mismo borrador abierto: la segunda que guarda no pisa lo que guardo la primera.
export class ConcurrentModificationError extends ConflictError {
  constructor(id: string) {
    super(
      `Entity <${id}> was modified by another request.`,
      'The document was modified by another user. Please refresh and try again.'
    );
  }
}
