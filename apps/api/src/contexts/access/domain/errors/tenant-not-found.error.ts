import { NotFoundError } from '../../../../shared/domain/domain.error.js';

export class TenantNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Tenant <${id}> does not exist.`);
  }
}
