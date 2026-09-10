import { ConflictError } from '../../../../shared/domain/domain.error.js';

export class DuplicateMembershipError extends ConflictError {
  constructor(userId: string, tenantId: string) {
    super(`User <${userId}> already belongs to tenant <${tenantId}>.`);
  }
}
