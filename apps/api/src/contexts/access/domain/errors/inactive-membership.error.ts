import { UnauthorizedError } from '../../../../shared/domain/domain.error.js';

export class InactiveMembershipError extends UnauthorizedError {
  constructor(userId: string, tenantId: string) {
    super(
      `Membership of user <${userId}> in tenant <${tenantId}> is not active.`,
      'Your access to this company is not active.',
    );
  }
}
