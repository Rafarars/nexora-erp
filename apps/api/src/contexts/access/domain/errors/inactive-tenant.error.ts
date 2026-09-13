import { UnauthorizedError } from '../../../../shared/domain/domain.error.js';

export class InactiveTenantError extends UnauthorizedError {
  constructor(tenantId: string) {
    super(`Tenant <${tenantId}> is not active.`, 'This company is not active.');
  }
}
