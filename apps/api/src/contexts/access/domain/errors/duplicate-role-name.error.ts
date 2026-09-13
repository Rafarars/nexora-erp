import { ConflictError } from '../../../../shared/domain/domain.error.js';

export class DuplicateRoleNameError extends ConflictError {
  constructor(name: string, tenantId: string) {
    super(
      `Role <${name}> already exists in tenant <${tenantId}>.`,
      'A role with that name already exists.',
    );
  }
}
