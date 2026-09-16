import { ConflictError } from './domain.error.js';

export class ConcurrentModificationError extends ConflictError {
  constructor(id: string) {
    super(
      `Entity <${id}> was modified by another request.`,
      'The document was modified by another user. Please refresh and try again.'
    );
  }
}
