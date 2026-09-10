import { NotFoundError } from '../../../../shared/domain/domain.error.js';

export class RoleNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Role <${id}> does not exist.`);
  }
}
