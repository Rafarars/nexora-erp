import { ForbiddenError } from '../../../../shared/domain/domain.error.js';

export class PermissionDeniedError extends ForbiddenError {
  constructor(permission: string) {
    super(`Permission <${permission}> is required.`);
  }
}
