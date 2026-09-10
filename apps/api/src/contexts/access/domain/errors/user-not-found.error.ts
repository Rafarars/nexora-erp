import { NotFoundError } from '../../../../shared/domain/domain.error.js';

export class UserNotFoundError extends NotFoundError {
  constructor(identifier: string) {
    super(`User <${identifier}> does not exist.`);
  }
}
