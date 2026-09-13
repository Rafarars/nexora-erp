import { ConflictError } from '../../../../shared/domain/domain.error.js';

export class EmailAlreadyInUseError extends ConflictError {
  constructor(email: string) {
    super(`Email <${email}> is already registered.`, 'That email is already registered.');
  }
}
