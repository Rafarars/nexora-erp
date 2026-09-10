import { NotFoundError } from '../../../../shared/domain/domain.error.js';

export class MembershipNotFoundError extends NotFoundError {
  constructor(userId: string, tenantId: string) {
    super(`User <${userId}> has no membership in tenant <${tenantId}>.`);
  }
}
